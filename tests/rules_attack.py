"""ทดสอบกฎความปลอดภัย Firestore (firestore.rules) ด้วย emulator ไม่แตะข้อมูลจริง

วิธีรัน (ต้องมี Java สำหรับ Firestore emulator):
  1) npx firebase-tools emulators:start --only auth,firestore --project <project-id>
  2) python tests/rules_attack.py          (รันได้เรื่อยๆ สคริปต์สร้างข้อมูลทดสอบเอง)

สคริปต์สร้างผู้ใช้ทดสอบ 5 คน (admin, overview, ua, ub, dis ที่ถูกปิดใช้งาน) แล้ว "โจมตี" กฎจากสิทธิ์ต่างๆ
แต่ละรายการระบุว่าควรอนุญาต (ALLOW) หรือปฏิเสธ (DENY) ถ้ามีรายการไหนไม่เป็นตามนั้น จะรายงาน FAIL และจบด้วยรหัสผิดพลาด
"""
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request

PROJECT = os.environ.get("PROJECT_ID", "ritz-dailylog-3476")
SETUP_KEY = os.environ.get("SETUP_KEY", "CHANGE_ME_SETUP_KEY")
DOMAIN = "dailylog.example.com"
FS = f"http://127.0.0.1:8080/v1/projects/{PROJECT}/databases/(default)"
AUTH = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1"
DOCS = f"projects/{PROJECT}/databases/(default)/documents"
OWNER = {"Authorization": "Bearer owner"}  # โทเคนพิเศษของ emulator ที่ข้ามกฎ ใช้เฉพาะตอนสร้างข้อมูลทดสอบ


def S(v):
    return {"stringValue": v}


B = {"booleanValue": True}
F = {"booleanValue": False}


def req(url, data=None, method=None, hdr=None):
    h = {"Content-Type": "application/json"}
    h.update(hdr or {})
    r = urllib.request.Request(url, data=json.dumps(data).encode() if data is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as f:
            return f.status, json.load(f)
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def signup(email, pw):
    s, t = req(f"{AUTH}/accounts:signUp?key=x", {"email": email, "password": pw, "returnSecureToken": True})
    assert s == 200, f"signUp failed for {email}: {t}"
    return {"Authorization": "Bearer " + t["idToken"]}


def commit(tok, writes):
    s, r = req(f"{FS}/documents:commit", {"writes": writes}, "POST", tok)
    return s


def get(tok, path):
    return req(f"{FS}/documents/{path}", hdr=tok)[0]


def query_owner(tok, owner):
    q = {"structuredQuery": {"from": [{"collectionId": "events"}], "where": {"fieldFilter": {"field": {"fieldPath": "ownerId"}, "op": "EQUAL", "value": S(owner)}}}}
    return req(f"{FS}/documents:runQuery", q, "POST", tok)[0]


def H(code):
    return hashlib.sha256(("dailylog:" + code).encode()).hexdigest()


def email(u, rev=0):
    return f"{u}.{rev}@{DOMAIN}"


# ------------------------------------------------------------------ ข้อมูลทดสอบ
PEOPLE = {  # username: (role, active, code)
    "admin": ("admin", True, "246810"),
    "overview": ("overview", True, "000111"),
    "ua": ("user", True, "111111"),
    "ub": ("user", True, "222222"),
    "dis": ("user", False, "333333"),
}
EVENT_BASE = {"date": S("2026-11-06"), "start": S("09:00"), "end": S("10:00"), "category": S("dev"), "status": S("todo"), "project": S(""), "note": S("")}


def event_fields(owner, title="x"):
    return {**EVENT_BASE, "title": S(title), "ownerId": S(owner), "ownerName": S(owner)}


def seed():
    toks = {}
    for u, (_, _, code) in PEOPLE.items():
        # ถ้าเคยรันแล้ว บัญชีมีอยู่ ให้ล็อกอินแทน
        s, t = req(f"{AUTH}/accounts:signUp?key=x", {"email": email(u), "password": code, "returnSecureToken": True})
        if s != 200:
            s, t = req(f"{AUTH}/accounts:signInWithPassword?key=x", {"email": email(u), "password": code, "returnSecureToken": True})
        toks[u] = {"Authorization": "Bearer " + t["idToken"]}
    writes = [{"update": {"name": f"{DOCS}/config/setup", "fields": {"setupKey": S(SETUP_KEY), "adminEmail": S(email("admin"))}}}]
    for u, (role, active, code) in PEOPLE.items():
        writes.append({"update": {"name": f"{DOCS}/users/{u}", "fields": {"username": S(u), "name": S(u.upper()), "role": S(role), "active": B if active else F, "authEmail": S(email(u))}}})
        writes.append({"update": {"name": f"{DOCS}/codes/{H(code)}", "fields": {"email": S(email(u)), "username": S(u)}}})
    for ev, owner in (("ev_ua", "ua"), ("ev_ub", "ub"), ("ev_admin", "admin")):
        writes.append({"update": {"name": f"{DOCS}/events/{ev}", "fields": event_fields(owner, ev)}})
    writes.append({"update": {"name": f"{DOCS}/events/ev_legacy", "fields": {**EVENT_BASE, "title": S("legacy")}}})  # งานเดิมที่ยังไม่มีเจ้าของ
    assert commit(OWNER, writes) == 200, "seed failed (emulator เปิดอยู่หรือไม่?)"
    toks["anon"] = {}
    toks["stranger"] = signup(f"evil{os.getpid()}.0@{DOMAIN}", "999999")      # สมัครบัญชีเองได้ แต่ไม่มีเอกสารผู้ใช้
    toks["squatter"] = signup(f"admin.7{os.getpid() % 90 + 10}@{DOMAIN}", "999999")  # แอบสมัครอีเมลคล้ายแอดมิน
    return toks


# ------------------------------------------------------------------ ชุดทดสอบ
results = []


def check(name, got, expect_ok):
    # 409 = สร้างเอกสารที่มีอยู่แล้วซ้ำ (เงื่อนไข exists:false ไม่ผ่าน) ไม่มีการเขียนเกิดขึ้น จึงนับเป็นการปฏิเสธ
    ok = (got == 200) if expect_ok else (got in (401, 403, 409))
    results.append((ok, name, got, "ALLOW" if expect_ok else "DENY"))


def user_doc(u, role="user", active=True):
    return {"username": S(u), "name": S("e"), "role": S(role), "active": B if active else F, "authEmail": S(email(u))}


def run():
    T = seed()
    D = lambda p: f"{DOCS}/{p}"

    # คนนอก / ผู้ใช้ที่ถูกปิดใช้งาน / คนแอบสมัครบัญชีเอง ต้องไม่ได้อะไรเลย
    for who in ("anon", "stranger", "squatter", "dis"):
        t = T[who]
        check(f"{who}: list events", get(t, "events"), False)
        check(f"{who}: query events", query_owner(t, "ua"), False)
        check(f"{who}: read users/admin", get(t, "users/admin"), False)
        check(f"{who}: create event", commit(t, [{"update": {"name": D("events/atk"), "fields": event_fields("ua")}, "currentDocument": {"exists": False}}]), False)
        check(f"{who}: create user doc", commit(t, [{"update": {"name": D("users/evil"), "fields": user_doc("evil", "admin")}, "currentDocument": {"exists": False}}]), False)
        check(f"{who}: create config/setup with the correct key", commit(t, [{"update": {"name": D("config/setup"), "fields": {"setupKey": S(SETUP_KEY), "adminEmail": S(email(who) if who != "anon" else "x")}}, "currentDocument": {"exists": False}}]), False)
        check(f"{who}: register a code for itself", commit(t, [{"update": {"name": D(f"codes/{H('123123')}"), "fields": {"email": S(email("ua")), "username": S("ua")}}, "currentDocument": {"exists": False}}]), False)
        check(f"{who}: list codes", get(t, "codes"), False)
        check(f"{who}: delete admin's code", commit(t, [{"delete": D(f"codes/{H('246810')}")}]), False)
    check("anon: get one code doc (login lookup)", get({}, f"codes/{H('000111')}"), True)

    # User ธรรมดา
    t = T["ua"]
    check("ua: list ALL events", get(t, "events"), False)
    check("ua: query own events", query_owner(t, "ua"), True)
    check("ua: query other user's events", query_owner(t, "ub"), False)
    check("ua: get other user's event", get(t, "events/ev_ub"), False)
    check("ua: update other user's event", commit(t, [{"update": {"name": D("events/ev_ub"), "fields": {"title": S("hacked")}}, "updateMask": {"fieldPaths": ["title"]}}]), False)
    check("ua: delete other user's event", commit(t, [{"delete": D("events/ev_ub")}]), False)
    check("ua: update legacy (ownerless) event", commit(t, [{"update": {"name": D("events/ev_legacy"), "fields": {"ownerId": S("ua"), "ownerName": S("ua")}}, "updateMask": {"fieldPaths": ["ownerId", "ownerName"]}}]), False)
    check("ua: create event owned by someone else", commit(t, [{"update": {"name": D("events/atk2"), "fields": event_fields("admin")}, "currentDocument": {"exists": False}}]), False)
    check("ua: create own event", commit(t, [{"update": {"name": D("events/ok1"), "fields": event_fields("ua")}, "currentDocument": {"exists": False}}]), True)
    check("ua: give own event away", commit(t, [{"update": {"name": D("events/ok1"), "fields": {"ownerId": S("admin")}}, "updateMask": {"fieldPaths": ["ownerId"]}}]), False)
    check("ua: javascript: link", commit(t, [{"update": {"name": D("events/ok1"), "fields": {"link": S("javascript:alert(1)")}}, "updateMask": {"fieldPaths": ["link"]}}]), False)
    check("ua: unknown field", commit(t, [{"update": {"name": D("events/ok1"), "fields": {"evil": S("1")}}, "updateMask": {"fieldPaths": ["evil"]}}]), False)
    check("ua: delete own event", commit(t, [{"delete": D("events/ok1")}]), True)
    check("ua: read users/admin", get(t, "users/admin"), False)
    check("ua: read own user doc", get(t, "users/ua"), True)
    check("ua: list users", get(t, "users"), False)
    check("ua: promote self to admin", commit(t, [{"update": {"name": D("users/ua"), "fields": {"role": S("admin")}}, "updateMask": {"fieldPaths": ["role"]}}]), False)
    check("ua: create user doc", commit(t, [{"update": {"name": D("users/evil"), "fields": user_doc("evil", "admin")}, "currentDocument": {"exists": False}}]), False)
    check("ua: register a NEW code for own account", commit(t, [{"update": {"name": D(f"codes/{H('424242')}"), "fields": {"email": S(email("ua")), "username": S("ua")}}, "currentDocument": {"exists": False}}]), True)
    check("ua: delete that code", commit(t, [{"delete": D(f"codes/{H('424242')}")}]), True)
    check("ua: overwrite overview's code doc (hijack)", commit(t, [{"update": {"name": D(f"codes/{H('000111')}"), "fields": {"email": S(email("ua")), "username": S("ua")}}}]), False)
    check("ua: code pointing at admin's account", commit(t, [{"update": {"name": D(f"codes/{H('424243')}"), "fields": {"email": S(email("admin")), "username": S("admin")}}, "currentDocument": {"exists": False}}]), False)
    check("ua: delete overview's code", commit(t, [{"delete": D(f"codes/{H('000111')}")}]), False)
    check("ua: list codes", get(t, "codes"), False)

    # Overview: ดูได้ทุกอย่างแต่แก้ไม่ได้
    t = T["overview"]
    check("overview: list ALL events", get(t, "events"), True)
    check("overview: create event", commit(t, [{"update": {"name": D("events/atk3"), "fields": event_fields("overview")}, "currentDocument": {"exists": False}}]), False)
    check("overview: update user's event", commit(t, [{"update": {"name": D("events/ev_ua"), "fields": {"title": S("x")}}, "updateMask": {"fieldPaths": ["title"]}}]), False)
    check("overview: delete user's event", commit(t, [{"delete": D("events/ev_ua")}]), False)
    check("overview: list users", get(t, "users"), False)
    check("overview: list codes", get(t, "codes"), False)

    # Admin: เห็นทุกคน แก้ได้เฉพาะของตัวเอง จัดการผู้ใช้ได้
    t = T["admin"]
    check("admin: list ALL events", get(t, "events"), True)
    check("admin: list users", get(t, "users"), True)
    check("admin: list codes", get(t, "codes"), True)
    check("admin: update user's event", commit(t, [{"update": {"name": D("events/ev_ua"), "fields": {"title": S("x")}}, "updateMask": {"fieldPaths": ["title"]}}]), False)
    check("admin: delete user's event", commit(t, [{"delete": D("events/ev_ua")}]), False)
    check("admin: claim legacy event for self", commit(t, [{"update": {"name": D("events/ev_legacy"), "fields": {"ownerId": S("admin"), "ownerName": S("admin")}}, "updateMask": {"fieldPaths": ["ownerId", "ownerName"]}}]), True)
    check("admin: claim an already-owned event", commit(t, [{"update": {"name": D("events/ev_ub"), "fields": {"ownerId": S("admin")}}, "updateMask": {"fieldPaths": ["ownerId"]}}]), False)
    check("admin: create + delete own event", commit(t, [{"update": {"name": D("events/ok2"), "fields": event_fields("admin")}, "currentDocument": {"exists": False}}]) == 200 and commit(t, [{"delete": D("events/ok2")}]), True)
    check("admin: demote self", commit(t, [{"update": {"name": D("users/admin"), "fields": {"role": S("user")}}, "updateMask": {"fieldPaths": ["role"]}}]), False)
    check("admin: deactivate self", commit(t, [{"update": {"name": D("users/admin"), "fields": {"active": F}}, "updateMask": {"fieldPaths": ["active"]}}]), False)
    check("admin: change a user's role", commit(t, [{"update": {"name": D("users/ua"), "fields": {"role": S("overview")}}, "updateMask": {"fieldPaths": ["role"]}}]), True)
    check("admin: restore the role", commit(t, [{"update": {"name": D("users/ua"), "fields": {"role": S("user")}}, "updateMask": {"fieldPaths": ["role"]}}]), True)
    check("admin: invalid role value", commit(t, [{"update": {"name": D("users/ua"), "fields": {"role": S("root")}}, "updateMask": {"fieldPaths": ["role"]}}]), False)
    check("admin: delete a user doc", commit(t, [{"delete": D("users/ua")}]), False)
    check("admin: create code for a user", commit(t, [{"update": {"name": D(f"codes/{H('515151')}"), "fields": {"email": S(email("ua")), "username": S("ua")}}, "currentDocument": {"exists": False}}]), True)
    check("admin: overwrite an existing code doc", commit(t, [{"update": {"name": D(f"codes/{H('515151')}"), "fields": {"email": S(email("ua")), "username": S("ua")}}}]), False)
    check("admin: delete that code", commit(t, [{"delete": D(f"codes/{H('515151')}")}]), True)
    check("admin: malformed code doc id", commit(t, [{"update": {"name": D("codes/not-a-hash"), "fields": {"email": S(email("ua")), "username": S("ua")}}, "currentDocument": {"exists": False}}]), False)

    bad = [r for r in results if not r[0]]
    for ok, name, got, exp in results:
        if not ok:
            print(f"FAIL [{exp} -> HTTP {got}] {name}")
    print(f"\n{len(results) - len(bad)}/{len(results)} passed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(run())
