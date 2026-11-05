// ตั้งค่าการเชื่อมต่อ Outlook / Teams (Microsoft Graph)
// ค่าสองตัวนี้ไม่ใช่ความลับ (เป็นตัวระบุแอปที่ลงทะเบียนใน Microsoft Entra ID) ขั้นตอนลงทะเบียนอยู่ใน README
// ถ้า clientId ว่าง ระบบจะไม่เปิดฟังก์ชันนี้ และหน้าตั้งค่าจะแสดงวิธีลงทะเบียนให้
export const msConfig = {
  clientId: 'ae821a89-6ce4-49d8-a13d-3a15265bbce2',   // Application (client) ID
  tenantId: 'af15a2fb-f2d1-417e-845b-bbaa45e9f98a',   // Directory (tenant) ID ของบริษัท
};
