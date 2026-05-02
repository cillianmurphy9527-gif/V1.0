-- PlanTemplate 数据初始化 SQL
-- 直接在数据库中执行此脚本即可

-- 删除现有数据（如果需要重新初始化）
-- DELETE FROM "PlanTemplate";

-- 插入套餐模板数据
INSERT INTO "PlanTemplate" ("planCode", "name", "price", "leadsLimit", "emailAccountsLimit", "dailySendLimit", "exportQuota", "features", "isActive", "createdAt", "updatedAt")
VALUES 
  ('FREE', '体验版', 0, 3, 0, 0, 0, '{"canUseInbox":false,"aiScoring":false,"multiDomain":false,"multiLanguage":false,"deepIntentAnalysis":false,"aiReplySuggestions":false,"ragUpload":false,"dataExport":false}', true, NOW(), NOW())
ON CONFLICT ("planCode") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "leadsLimit" = EXCLUDED."leadsLimit",
  "emailAccountsLimit" = EXCLUDED."emailAccountsLimit",
  "dailySendLimit" = EXCLUDED."dailySendLimit",
  "exportQuota" = EXCLUDED."exportQuota",
  "features" = EXCLUDED."features",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

INSERT INTO "PlanTemplate" ("planCode", "name", "price", "leadsLimit", "emailAccountsLimit", "dailySendLimit", "exportQuota", "features", "isActive", "createdAt", "updatedAt")
VALUES 
  ('STARTER', '试运营版', 399, 300, 1, 999999, 0, '{"canUseInbox":true,"aiScoring":true,"multiDomain":false,"multiLanguage":false,"deepIntentAnalysis":false,"aiReplySuggestions":false,"ragUpload":true,"dataExport":false}', true, NOW(), NOW())
ON CONFLICT ("planCode") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "leadsLimit" = EXCLUDED."leadsLimit",
  "emailAccountsLimit" = EXCLUDED."emailAccountsLimit",
  "dailySendLimit" = EXCLUDED."dailySendLimit",
  "exportQuota" = EXCLUDED."exportQuota",
  "features" = EXCLUDED."features",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

INSERT INTO "PlanTemplate" ("planCode", "name", "price", "leadsLimit", "emailAccountsLimit", "dailySendLimit", "exportQuota", "features", "isActive", "createdAt", "updatedAt")
VALUES 
  ('PRO', '增长版', 999, 1000, 3, 999999, 50, '{"canUseInbox":true,"aiScoring":true,"multiDomain":true,"multiLanguage":true,"deepIntentAnalysis":true,"aiReplySuggestions":true,"ragUpload":true,"dataExport":true}', true, NOW(), NOW())
ON CONFLICT ("planCode") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "leadsLimit" = EXCLUDED."leadsLimit",
  "emailAccountsLimit" = EXCLUDED."emailAccountsLimit",
  "dailySendLimit" = EXCLUDED."dailySendLimit",
  "exportQuota" = EXCLUDED."exportQuota",
  "features" = EXCLUDED."features",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

INSERT INTO "PlanTemplate" ("planCode", "name", "price", "leadsLimit", "emailAccountsLimit", "dailySendLimit", "exportQuota", "features", "isActive", "createdAt", "updatedAt")
VALUES 
  ('MAX', '旗舰版', 3999, 3000, 10, 999999, 200, '{"canUseInbox":true,"aiScoring":true,"multiDomain":true,"multiLanguage":true,"deepIntentAnalysis":true,"aiReplySuggestions":true,"ragUpload":true,"dataExport":true}', true, NOW(), NOW())
ON CONFLICT ("planCode") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "leadsLimit" = EXCLUDED."leadsLimit",
  "emailAccountsLimit" = EXCLUDED."emailAccountsLimit",
  "dailySendLimit" = EXCLUDED."dailySendLimit",
  "exportQuota" = EXCLUDED."exportQuota",
  "features" = EXCLUDED."features",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = NOW();

-- 验证数据
SELECT * FROM "PlanTemplate" ORDER BY "price" ASC;
