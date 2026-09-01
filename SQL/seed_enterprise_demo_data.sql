-- =============================================================================
-- IT Infrastructure Management System (ITIMS)
-- Enterprise Demo Seed Data: Curated High-Fidelity Topology & Asset Roster
-- =============================================================================

BEGIN;

-- 1. Clean existing mock/stale asset data to ensure consistent demo environment
DELETE FROM public.asset_audits;
DELETE FROM public.license_allocations;
DELETE FROM public.software_licenses;
DELETE FROM public.asset_relationships;
DELETE FROM public.asset_metrics;
DELETE FROM public.incidents;
DELETE FROM public.assets;

-- 2. Fetch Department IDs
DO $$
DECLARE
    v_eng_id UUID;
    v_ops_id UUID;
    v_sec_id UUID;
    v_fin_id UUID;
    v_exec_id UUID;
    v_admin_id UUID;

    -- Asset IDs
    id_core_sw UUID := gen_random_uuid();
    id_edge_fw UUID := gen_random_uuid();
    id_san_storage UUID := gen_random_uuid();
    id_ups UUID := gen_random_uuid();
    id_db_cluster UUID := gen_random_uuid();
    id_app_server UUID := gen_random_uuid();
    id_auth_server UUID := gen_random_uuid();
    id_aws_k8s UUID := gen_random_uuid();
    id_cloudflare UUID := gen_random_uuid();
    id_macbook UUID := gen_random_uuid();
    id_precision_ws UUID := gen_random_uuid();
    id_thinkpad UUID := gen_random_uuid();
    id_latitude UUID := gen_random_uuid();
    id_sw_jetbrains UUID := gen_random_uuid();
    id_sw_docker UUID := gen_random_uuid();
    id_sw_m365 UUID := gen_random_uuid();
    id_sw_datadog UUID := gen_random_uuid();
    id_dell_monitor UUID := gen_random_uuid();
    id_canon_printer UUID := gen_random_uuid();
    id_jabra_speaker UUID := gen_random_uuid();

    -- License IDs
    id_lic_jetbrains UUID := gen_random_uuid();
    id_lic_docker UUID := gen_random_uuid();
    id_lic_m365 UUID := gen_random_uuid();

BEGIN
    -- Get department IDs
    SELECT id INTO v_eng_id FROM public.departments WHERE code = 'ENG';
    SELECT id INTO v_ops_id FROM public.departments WHERE code = 'OPS';
    SELECT id INTO v_sec_id FROM public.departments WHERE code = 'SEC';
    SELECT id INTO v_fin_id FROM public.departments WHERE code = 'FIN';
    SELECT id INTO v_exec_id FROM public.departments WHERE code = 'EXEC';

    -- Get admin user profile ID
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
    IF v_admin_id IS NULL THEN
        SELECT id INTO v_admin_id FROM public.profiles LIMIT 1;
    END IF;

    -- -------------------------------------------------------------------------
    -- INSERT CURATED ENTERPRISE ASSETS
    -- -------------------------------------------------------------------------

    -- 1. Core-SW01: Cisco Catalyst 9300
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_core_sw, 'Core-SW01: Cisco Catalyst 9300 48P', 'network', 'active', 'Datacenter Vault 1 - Rack A1', 'FCW2348A019', 'Primary enterprise L3 core backbone switch with dual 100G uplinks', 320000.00, 30000.00, 7, 'straight_line', '2022-03-15', '2027-03-15', v_ops_id, v_admin_id, 'verified', now() - INTERVAL '12 days');

    -- 2. Edge-FW01: Palo Alto PA-3220
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_edge_fw, 'Edge-FW01: Palo Alto PA-3220', 'network', 'active', 'Datacenter Vault 1 - Rack A1', '012901004821', 'Next-gen perimeter edge firewall with WildFire threat intelligence', 450000.00, 45000.00, 5, 'straight_line', '2023-01-10', '2028-01-10', v_sec_id, v_admin_id, 'verified', now() - INTERVAL '5 days');

    -- 3. SAN-Storage01: NetApp AFF A250
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_san_storage, 'SAN-Storage01: NetApp AFF A250', 'infrastructure', 'active', 'Datacenter Vault 1 - Rack C2', 'NA-AFF250-9981', 'NVMe-based enterprise SAN storage array with 120TB raw all-flash capacity', 850000.00, 100000.00, 6, 'straight_line', '2022-08-20', '2027-08-20', v_ops_id, v_admin_id, 'verified', now() - INTERVAL '20 days');

    -- 4. UPS-Array01: APC Symmetra PX 48kW
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_ups, 'UPS-Array01: APC Symmetra PX 48kW', 'infrastructure', 'active', 'Datacenter Power Facility B', 'APC-SY48K-4410', 'High-efficiency redundant N+1 power backup array for datacenter vaults', 500000.00, 50000.00, 10, 'straight_line', '2021-06-01', '2031-06-01', v_ops_id, v_admin_id, 'verified', now() - INTERVAL '40 days');

    -- 5. DB-Cluster-01: Dell PowerEdge R750
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_db_cluster, 'DB-Cluster-01: Dell PowerEdge R750 (PostgreSQL 17 HA)', 'hardware', 'active', 'Datacenter Vault 1 - Rack B3', 'DEL-R750-7741', 'Dual Xeon Platinum 8368, 512GB ECC RAM, enterprise transactional DB cluster', 680000.00, 60000.00, 5, 'double_declining', '2023-04-12', '2028-04-12', v_eng_id, v_admin_id, 'verified', now() - INTERVAL '8 days');

    -- 6. App-Server-01: HPE ProLiant DL380 Gen10
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_app_server, 'App-Server-01: HPE ProLiant DL380 Gen10 (Production API)', 'hardware', 'active', 'Datacenter Vault 1 - Rack B3', 'HPE-DL380-5592', 'Core backend API server cluster running containerized microservices', 540000.00, 50000.00, 5, 'straight_line', '2023-02-18', '2028-02-18', v_eng_id, v_admin_id, 'verified', now() - INTERVAL '15 days');

    -- 7. Auth-Server-01: Dell PowerEdge R650
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_auth_server, 'Auth-Server-01: Dell PowerEdge R650 (Identity & OAuth2)', 'hardware', 'active', 'Datacenter Vault 1 - Rack B4', 'DEL-R650-3329', 'Dedicated IAM, single sign-on, and cryptographic key management cluster', 420000.00, 40000.00, 5, 'straight_line', '2023-05-01', '2028-05-01', v_sec_id, v_admin_id, 'verified', now() - INTERVAL '2 days');

    -- 8. AWS us-east-1 Kubernetes Cluster
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status)
    VALUES (id_aws_k8s, 'AWS us-east-1 Production Kubernetes (EKS)', 'infrastructure', 'active', 'AWS us-east-1 (N. Virginia)', 'AWS-EKS-PROD-01', 'Managed multi-AZ Elastic Kubernetes Service cluster for autoscaling microservices', 180000.00, 0.00, 3, 'none', '2023-01-01', '2026-01-01', v_eng_id, v_admin_id, 'verified');

    -- 9. Cloudflare Enterprise CDN & WAF
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status)
    VALUES (id_cloudflare, 'Cloudflare Enterprise CDN & DDoS Shield', 'infrastructure', 'active', 'Global Edge Anycast Network', 'CF-ENT-ZONE-981', 'Global CDN edge caching, SSL/TLS offloading, and Layer 7 DDoS mitigation', 90000.00, 0.00, 3, 'none', '2023-01-01', '2026-01-01', v_sec_id, v_admin_id, 'verified');

    -- 10. MacBook Pro 16" M3 Max
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_macbook, 'MacBook Pro 16" M3 Max (Lead Architect)', 'hardware', 'in_use', 'Floor 3 - Desk 42 (Engineering)', 'C02G9981MD6R', 'Apple M3 Max 16-core CPU, 40-core GPU, 64GB Unified RAM, 2TB SSD', 349900.00, 50000.00, 4, 'straight_line', '2023-11-20', '2026-11-20', v_eng_id, v_admin_id, 'verified', now() - INTERVAL '1 day');

    -- 11. Dell Precision 5820 Workstation
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_precision_ws, 'Dell Precision 5820 Workstation (AI/ML Dev)', 'hardware', 'active', 'Floor 2 - AI Research Lab', 'DEL-P5820-9941', 'Intel Xeon W-2295, Dual NVIDIA RTX A6000 48GB, 128GB RAM', 280000.00, 40000.00, 4, 'double_declining', '2023-06-15', '2027-06-15', v_eng_id, v_admin_id, 'verified', now() - INTERVAL '30 days');

    -- 12. Lenovo ThinkPad P1 Gen 6
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_thinkpad, 'Lenovo ThinkPad P1 Gen 6 (DevOps Lead)', 'hardware', 'in_use', 'Floor 3 - Desk 18 (Engineering)', 'PF-4X8911-LNV', 'Intel Core i9-13900H, 64GB DDR5, NVIDIA RTX 4080, 2TB PCIe Gen4 SSD', 210000.00, 30000.00, 4, 'straight_line', '2023-08-10', '2026-08-10', v_eng_id, v_admin_id, 'verified', now() - INTERVAL '14 days');

    -- 13. Dell Latitude 7440
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_latitude, 'Dell Latitude 7440 (Security Analyst)', 'hardware', 'in_use', 'Floor 4 - SOC Desk 6', 'DEL-LAT7440-22', 'Intel Core i7-1365U vPro, 32GB RAM, 1TB NVMe, biometric reader', 145000.00, 20000.00, 3, 'straight_line', '2023-09-01', '2026-09-01', v_sec_id, v_admin_id, 'verified', now() - INTERVAL '7 days');

    -- 14. JetBrains All Products Pack (Software Asset)
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status)
    VALUES (id_sw_jetbrains, 'JetBrains All Products Pack', 'software', 'active', 'Organization Cloud Account', 'JB-ENT-SUB-2024', 'Enterprise IDE suite including IntelliJ IDEA Ultimate, WebStorm, PyCharm, GoLand, CLion', 250000.00, 0.00, 1, 'none', '2024-01-01', '2025-01-01', v_eng_id, v_admin_id, 'verified');

    -- 15. Docker Desktop Enterprise (Software Asset)
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status)
    VALUES (id_sw_docker, 'Docker Desktop Enterprise', 'software', 'active', 'Organization Cloud Account', 'DKR-ENT-2024-50', 'Developer containerization engine, hardened Docker Scout security, Hub organization access', 120000.00, 0.00, 1, 'none', '2024-01-01', '2025-01-01', v_eng_id, v_admin_id, 'verified');

    -- 16. Microsoft 365 Enterprise E5 (Software Asset)
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status)
    VALUES (id_sw_m365, 'Microsoft 365 Enterprise E5', 'software', 'active', 'Azure Tenant: itims.onmicrosoft.com', 'MSFT-E5-ORG-991', 'Complete productivity, Entra ID P2, Defender for Endpoint, Intune MDM, Teams Enterprise', 480000.00, 0.00, 1, 'none', '2024-01-01', '2025-01-01', v_ops_id, v_admin_id, 'verified');

    -- 17. Datadog APM & Cloud Monitoring
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status)
    VALUES (id_sw_datadog, 'Datadog APM & Cloud Monitoring', 'software', 'active', 'SaaS Monitoring Hub', 'DD-PRO-ANNUAL-88', 'Unified observability: distributed tracing, infrastructure metrics, synthetic probes, log management', 360000.00, 0.00, 1, 'none', '2024-01-01', '2025-01-01', v_ops_id, v_admin_id, 'verified');

    -- 18. Dell UltraSharp 32" 4K PremierColor
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_dell_monitor, 'Dell UltraSharp 32" 4K USB-C Hub (U3223QE)', 'peripherals', 'active', 'Floor 3 - Desk 42 (Engineering)', 'CN-0M912P-74261', '31.5-inch 4K IPS Black monitor with 90W USB-C PD hub and RJ45 Ethernet pass-through', 82000.00, 8000.00, 5, 'straight_line', '2023-11-25', '2026-11-25', v_eng_id, v_admin_id, 'verified', now() - INTERVAL '1 day');

    -- 19. Canon imageRUNNER ADVANCE DX C3835i
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_canon_printer, 'Canon imageRUNNER ADVANCE DX C3835i', 'peripherals', 'active', 'Floor 2 - Central Copy Hub', 'CAN-IR3835-9921', 'High-capacity secure enterprise color multifunction print/scan unit with badge authentication', 240000.00, 30000.00, 5, 'straight_line', '2022-09-14', '2027-09-14', v_ops_id, v_admin_id, 'verified', now() - INTERVAL '18 days');

    -- 20. Jabra Speak 810 Conference System
    INSERT INTO public.assets (id, name, type, status, location, serial_number, description, cost, salvage_value, useful_life_years, depreciation_method, purchase_date, warranty_expiry, department_id, created_by, audit_status, last_audited_at)
    VALUES (id_jabra_speaker, 'Jabra Speak 810 Pro Conference Unit', 'peripherals', 'active', 'Executive Boardroom A', 'JBR-SPK810-338', 'Omnidirectional Zoom-certified boardroom speakerphone array with Bluetooth & NFC', 48000.00, 5000.00, 5, 'straight_line', '2023-04-10', '2026-04-10', v_exec_id, v_admin_id, 'verified', now() - INTERVAL '25 days');


    -- -------------------------------------------------------------------------
    -- 2. CMDB TOPOLOGY DEPENDENCY RELATIONSHIPS (Interactive Graph)
    -- -------------------------------------------------------------------------

    -- App-Server-01 connects to Core Switch
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_core_sw, id_app_server, 'connects_to', 'Dual 25GbE SFP28 trunk link');

    -- DB-Cluster-01 connects to Core Switch
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_core_sw, id_db_cluster, 'connects_to', 'Dual 25GbE isolated database VLAN');

    -- Core Switch connects to Edge Firewall
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_edge_fw, id_core_sw, 'connects_to', 'Redundant 40G optical interconnect');

    -- Cloudflare connects to Edge Firewall
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_cloudflare, id_edge_fw, 'connects_to', 'Authenticated Origin Pulls & GRE Tunnel');

    -- App-Server-01 depends on DB-Cluster-01
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_db_cluster, id_app_server, 'depends_on', 'Transactional ACID queries & read-replica pool');

    -- App-Server-01 depends on Auth-Server-01
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_auth_server, id_app_server, 'depends_on', 'JWT signature verification & RBAC token introspect');

    -- SAN-Storage01 backs up DB-Cluster-01
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_san_storage, id_db_cluster, 'backs_up', 'Hourly WAL archiving and daily snapshot replication');

    -- UPS powers Core Switch and Server Racks
    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_ups, id_core_sw, 'hosts', 'Primary UPS Feeder A power circuit');

    INSERT INTO public.asset_relationships (parent_asset_id, child_asset_id, relationship_type, notes)
    VALUES (id_ups, id_db_cluster, 'hosts', 'Primary UPS Feeder A power circuit');


    -- -------------------------------------------------------------------------
    -- 3. SOFTWARE LICENSES & SEAT ALLOCATIONS
    -- -------------------------------------------------------------------------

    -- JetBrains License Pool (50 Seats)
    INSERT INTO public.software_licenses (id, software_asset_id, license_name, license_key, license_type, total_seats, cost_per_seat, purchase_date, expiration_date, vendor, department_id, created_by)
    VALUES (id_lic_jetbrains, id_sw_jetbrains, 'JetBrains All Products Pack - Enterprise Pool', 'JB-ENT-9948-AAAA-BBBB-CCCC', 'per_seat', 50, 5000.00, '2024-01-01', '2025-01-01', 'JetBrains s.r.o.', v_eng_id, v_admin_id);

    -- Allocate JetBrains seats to developer machines
    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_jetbrains, id_macbook, 'Assigned to Lead Architect');

    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_jetbrains, id_thinkpad, 'Assigned to DevOps Lead');

    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_jetbrains, id_precision_ws, 'Assigned to AI/ML Research Workstation');

    -- Docker Desktop Enterprise License Pool (25 Seats)
    INSERT INTO public.software_licenses (id, software_asset_id, license_name, license_key, license_type, total_seats, cost_per_seat, purchase_date, expiration_date, vendor, department_id, created_by)
    VALUES (id_lic_docker, id_sw_docker, 'Docker Desktop Commercial Annual Pool', 'DKR-PROD-8812-XXXX-YYYY-ZZZZ', 'subscription', 25, 4800.00, '2024-01-01', '2025-01-01', 'Docker Inc.', v_eng_id, v_admin_id);

    -- Allocate Docker seats
    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_docker, id_macbook, 'Local container development environment');

    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_docker, id_thinkpad, 'CI/CD pipeline test runner');

    -- Microsoft 365 E5 License Pool (100 Seats)
    INSERT INTO public.software_licenses (id, software_asset_id, license_name, license_key, license_type, total_seats, cost_per_seat, purchase_date, expiration_date, vendor, department_id, created_by)
    VALUES (id_lic_m365, id_sw_m365, 'M365 E5 Cloud Tenant Subscription', 'MSFT-TENANT-E5-554109', 'subscription', 100, 4800.00, '2024-01-01', '2025-01-01', 'Microsoft Corporation', v_ops_id, v_admin_id);

    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_m365, id_macbook, 'Assigned productivity & Defender agent');

    INSERT INTO public.license_allocations (license_id, allocated_to_asset_id, notes)
    VALUES (id_lic_m365, id_latitude, 'Assigned security suite & Intune MDM');


    -- -------------------------------------------------------------------------
    -- 4. INCIDENTS & MAINTENANCE REPAIRS (TCO OpEx)
    -- -------------------------------------------------------------------------

    -- Incident 1: Core Switch Fan Tray Replacement
    INSERT INTO public.incidents (title, description, severity, status, category, asset_id, maintenance_cost, created_by, resolved_at)
    VALUES (
        'Core-SW01: Fan Tray #2 Sensor Failure & RPM Degradation',
        'Telemetry reported RPM drop below 1200 on Fan Tray 2. Dispatched Cisco on-site smartnet engineer to hot-swap replacement fan module.',
        'medium',
        'resolved',
        'hardware',
        id_core_sw,
        14500.00,
        v_admin_id,
        now() - INTERVAL '10 days'
    );

    -- Incident 2: DB-Cluster SSD Proactive Rebuild
    INSERT INTO public.incidents (title, description, severity, status, category, asset_id, maintenance_cost, created_by, resolved_at)
    VALUES (
        'DB-Cluster-01: SMART Wear-out Level Exceeded on NVMe Slot 3',
        'SMART telemetry alert detected wear leveling reached 92%. Replaced with enterprise Micron 7450 PRO 3.84TB NVMe SSD and completed RAID10 rebuild.',
        'high',
        'resolved',
        'hardware',
        id_db_cluster,
        38000.00,
        v_admin_id,
        now() - INTERVAL '6 days'
    );

    -- Incident 3: Active Alert on Edge Firewall
    INSERT INTO public.incidents (title, description, severity, status, category, asset_id, maintenance_cost, created_by)
    VALUES (
        'Edge-FW01: High SYN Flood Connection Spike on DMZ Interface',
        'Intrusion prevention engine blocked 45,000 anomalous TCP SYN handshakes from external subnet. Dynamic blocklist rule deployed.',
        'critical',
        'open',
        'security',
        id_edge_fw,
        0.00,
        v_admin_id
    );


    -- -------------------------------------------------------------------------
    -- 5. PHYSICAL AUDIT INSPECTION LOGS
    -- -------------------------------------------------------------------------
    INSERT INTO public.asset_audits (asset_id, auditor_id, location_verified, observed_location, status_verified, observed_status, physical_condition, scan_method, notes, audited_at)
    VALUES (id_core_sw, v_admin_id, true, 'Datacenter Vault 1 - Rack A1', true, 'active', 'excellent', 'camera_qr', 'Port activity lights normal. Cable management clean.', now() - INTERVAL '12 days');

    INSERT INTO public.asset_audits (asset_id, auditor_id, location_verified, observed_location, status_verified, observed_status, physical_condition, scan_method, notes, audited_at)
    VALUES (id_edge_fw, v_admin_id, true, 'Datacenter Vault 1 - Rack A1', true, 'active', 'excellent', 'camera_qr', 'Verified hardware serial tag and dual power connections.', now() - INTERVAL '5 days');

    INSERT INTO public.asset_audits (asset_id, auditor_id, location_verified, observed_location, status_verified, observed_status, physical_condition, scan_method, notes, audited_at)
    VALUES (id_db_cluster, v_admin_id, true, 'Datacenter Vault 1 - Rack B3', true, 'active', 'excellent', 'camera_qr', 'Inspected front drive caddies post-rebuild. Bezel locked.', now() - INTERVAL '8 days');

    INSERT INTO public.asset_audits (asset_id, auditor_id, location_verified, observed_location, status_verified, observed_status, physical_condition, scan_method, notes, audited_at)
    VALUES (id_macbook, v_admin_id, true, 'Floor 3 - Desk 42 (Engineering)', true, 'in_use', 'excellent', 'camera_qr', 'Physical condition pristine. Verified Asset Tag QR sticker on base.', now() - INTERVAL '1 day');

    INSERT INTO public.asset_audits (asset_id, auditor_id, location_verified, observed_location, status_verified, observed_status, physical_condition, scan_method, notes, audited_at)
    VALUES (id_dell_monitor, v_admin_id, true, 'Floor 3 - Desk 42 (Engineering)', true, 'active', 'excellent', 'camera_qr', 'Display calibration and stand verified.', now() - INTERVAL '1 day');

    -- -------------------------------------------------------------------------
    -- 6. REAL-TIME METRICS FOR ASSETS
    -- -------------------------------------------------------------------------
    INSERT INTO public.asset_metrics (asset_id, cpu_usage, memory_usage, disk_usage, network_in, network_out, health_status, last_updated)
    VALUES 
        (id_core_sw, 18.5, 42.0, 15.0, 1420.5, 1890.2, 'healthy', now()),
        (id_edge_fw, 64.2, 78.5, 34.0, 3200.0, 3100.0, 'warning', now()),
        (id_db_cluster, 38.0, 82.4, 61.2, 850.0, 1250.0, 'healthy', now()),
        (id_app_server, 45.2, 68.0, 48.5, 2100.0, 2400.0, 'healthy', now()),
        (id_auth_server, 12.0, 35.0, 22.0, 120.0, 180.0, 'healthy', now()),
        (id_macbook, 28.5, 71.0, 52.0, 45.0, 22.0, 'healthy', now()),
        (id_precision_ws, 88.0, 91.5, 74.0, 450.0, 600.0, 'warning', now());

END $$;

COMMIT;
