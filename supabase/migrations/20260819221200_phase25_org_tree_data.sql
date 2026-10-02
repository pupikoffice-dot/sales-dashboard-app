-- Phase 2.5 data: beginning-phase org tree (idempotent by username).
-- Tree:
--   kadima roy (super_admin)
--   ├── roypupik (admin)
--   ├── avishai (admin)
--   ├── dudi (cco)
--   ├── kfir (manager)
--   │   ├── 24 liron (agent ERP 24)
--   │   ├── 25 Or (agent ERP 25)   -- Auth user created separately if missing
--   │   └── 27 asaf (agent ERP 27)
--   └── test (agent)

UPDATE user_profiles SET name = 'kadima roy'
WHERE role = 'super_admin' AND email ILIKE 'kadima.roy%';

UPDATE user_profiles
SET role = 'admin'::user_role,
    parent_id = (SELECT id FROM user_profiles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
    agent_erp_id = NULL
WHERE username IN ('roypupik', 'avishai');

UPDATE user_profiles
SET role = 'cco'::user_role,
    parent_id = (SELECT id FROM user_profiles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
    agent_erp_id = NULL
WHERE username = 'dudi';

UPDATE user_profiles
SET role = 'manager'::user_role,
    name = 'kfir',
    parent_id = (SELECT id FROM user_profiles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
    agent_erp_id = NULL
WHERE username = 'kfir';

UPDATE user_profiles
SET role = 'agent'::user_role,
    name = 'liron',
    parent_id = (SELECT id FROM user_profiles WHERE username = 'kfir' LIMIT 1),
    agent_erp_id = '24'
WHERE username = '24';

UPDATE user_profiles
SET role = 'agent'::user_role,
    parent_id = (SELECT id FROM user_profiles WHERE role = 'super_admin' ORDER BY created_at LIMIT 1),
    agent_erp_id = NULL
WHERE username = 'test';

UPDATE user_profiles
SET role = 'agent'::user_role,
    name = 'Or',
    parent_id = (SELECT id FROM user_profiles WHERE username = 'kfir' LIMIT 1),
    agent_erp_id = '25'
WHERE username = '25';

UPDATE user_profiles
SET role = 'agent'::user_role,
    name = 'asaf',
    parent_id = (SELECT id FROM user_profiles WHERE username = 'kfir' LIMIT 1),
    agent_erp_id = '27'
WHERE username = '27';
