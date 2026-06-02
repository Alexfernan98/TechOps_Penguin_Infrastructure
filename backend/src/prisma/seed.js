const prisma = require('../../prisma/client');
const SEED_USERS = require('./seed-users.json');

// ─────────────────────────────────────────────────────────────────────────────
// Catálogos (alineados a §16 del desarrollo.md y al prototipo)
// ─────────────────────────────────────────────────────────────────────────────

const LOCATIONS = [
  { slug: 'NOC',         name: 'NOC',         siteCode: 'PE1H' },
  { slug: 'NETWORKING',  name: 'Networking',  siteCode: 'PE1H' },
  { slug: 'MINING_OPS',  name: 'Mining Ops.', siteCode: 'PE1H' },
  { slug: 'MSU',         name: 'MSU',         siteCode: 'PE1H' },
];

const DEPARTMENTS = [
  { slug: 'MINING_OPS',                  name: 'Minning Operations',          parentSlug: null,           type: 'DEPARTMENT' },
  { slug: 'MINING_OPS_MICROELECTRONICS', name: 'MicroElectronics',            parentSlug: 'MINING_OPS',   type: 'TEAM' },
  { slug: 'MINING_OPS_NETWORKING_CS',    name: 'Cybersecurity & Networking',  parentSlug: 'MINING_OPS',   type: 'TEAM' },
  { slug: 'MINING_OPS_DEVELOPERS',       name: 'Developers',                  parentSlug: 'MINING_OPS',   type: 'TEAM' },
  { slug: 'MINING_OPS_AUTOMATION',       name: 'Automation',                  parentSlug: 'MINING_OPS',   type: 'TEAM' },
  { slug: 'FACILITY',                    name: 'Facility',                    parentSlug: null,           type: 'DEPARTMENT' },
  { slug: 'FACILITY_MSU',                name: 'MSU',                         parentSlug: 'FACILITY',     type: 'TEAM' },
  { slug: 'MAINTENANCE',                 name: 'Maintenance',                 parentSlug: null,           type: 'DEPARTMENT' },
  { slug: 'PEOPLE_CULTURE',              name: 'People & Culture',            parentSlug: null,           type: 'DEPARTMENT' },
  { slug: 'PEOPLE_CULTURE_SAFETY',       name: 'Security and Health',        parentSlug: 'PEOPLE_CULTURE', type: 'TEAM' },
  { slug: 'WAREHOUSE',                   name: 'Warehouse',                   parentSlug: null,           type: 'DEPARTMENT' },
  { slug: 'PROJECTS',                    name: 'Projects',                    parentSlug: null,           type: 'DEPARTMENT' },
  { slug: 'DIRECTORY',                   name: 'Directory',                   parentSlug: null,           type: 'DEPARTMENT' },
];

const ASSET_CATEGORIES = [
  { slug: 'desktop',  name: 'PC',         tagPrefix: 'PE1H-IT-PC-',  icon: 'Monitor' },
  { slug: 'monitor',  name: 'Monitor',    tagPrefix: 'PE1H-IT-MON-', icon: 'Monitor' },
  { slug: 'notebook', name: 'Notebook',   tagPrefix: 'PE1H-IT-NB-',  icon: 'Laptop' },
  { slug: 'mouse',    name: 'Mouse',      tagPrefix: 'PE1H-IT-MOU-', icon: 'Mouse' },
  { slug: 'keyboard', name: 'Teclado',    tagPrefix: 'PE1H-IT-TEC-', icon: 'Keyboard' },
  { slug: 'printer',  name: 'Impresora',  tagPrefix: 'PE1H-IT-IMP-', icon: 'Printer' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mapeos del CSV de activos (nombres en español → enums/slugs)
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_BY_TYPE = {
  'PC': 'desktop', 'Monitor': 'monitor', 'Notebook': 'notebook',
  'Mouse': 'mouse', 'Teclado': 'keyboard', 'Impresora': 'printer',
};

const DEPT_BY_CSV = {
  'Mining Ops.': 'MINING_OPS',
  'Mantenimiento': 'MAINTENANCE',
  'Facility':    'FACILITY',
};

const LOC_BY_CSV = {
  'NOC':         'NOC',
  'Networking':  'NETWORKING',
  'Mining Ops.': 'MINING_OPS',
  'MsU':         'MSU',
  'MSU':         'MSU',
};

const STATUS_BY_CSV = {
  'Asignado': 'ASSIGNED', 'Disponible': 'AVAILABLE', 'En baja': 'RETIRED',
};

const CONDITION_BY_CSV = {
  'Bueno': 'GOOD', 'Regular': 'FAIR', 'Malo': 'POOR', 'Dañado': 'DAMAGED', '': 'GOOD',
};

// Nombres como aparecen en el CSV de activos → email canónico (cuentas funcionales + casos no triviales).
// El resto se resuelve por match exacto contra User.name.
const NAME_OVERRIDES = {
  'Penguin - Noc Notifications':                 'noc.notifications@penguin.digital',
  'Mantenimiento Data Center - Hernandarias':    'mantenimiento.dc@penguin.digital',
  'Monitoring and Security Unit Hernandarias':   'msu.hernandarias@penguin.digital',
  'Networking Ciberseguridad':                   'networking.ciberseg@penguin.digital',
  'Lorenzo Antonio Martinez Ferreira':           'lorenzo.martinez@penguin.digital',
  'Jose Mariano Ruiz Diaz Noguera':              'jose.ruizdiaz@penguin.digital',
  'Alexis Fernandez':                            'alexis.fernandez@penguin.digital',
  'Allan Fernandez':                             'allan.fernandez@penguin.digital',
  'Ronaldo Chavez':                              'ronaldo.chavez@penguin.digital',
  'Carlos Obelar':                               'carlos.obelar@penguin.digital',
  'Jorge Daniel Sanchez Ramirez':                'jorge.sanchez@penguin.digital',
  // Jorge Caballero no figura en el organigrama oficial — se omitirá silenciosamente
};

// ─────────────────────────────────────────────────────────────────────────────
// Activos del CSV (55 registros) — mantenidos del seed anterior
// ─────────────────────────────────────────────────────────────────────────────

const ASSETS_CSV = [
  { tag:'PE1H-IT-PC-001',  type:'PC',        brand:'Desktop',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 11 Pro',         status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'PC Izquierda',                                    condition:'Bueno', notes:null },
  { tag:'PE1H-IT-PC-002',  type:'PC',        brand:'Desktop',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 11 Pro',         status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'PC Derecha',                                      condition:'Bueno', notes:null },
  { tag:'PE1H-IT-PC-003',  type:'PC',        brand:'Desktop',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 11 Pro',         status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'PC Principal',                                    condition:'Bueno', notes:null },
  { tag:'PE1H-IT-PC-004',  type:'PC',        brand:'HikVision', model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'PC Hik Pools',                                    condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MOU-001', type:'Mouse',     brand:'Logitech',  model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Teclado para pcs y TVs',                          condition:'',      notes:null },
  { tag:'PE1H-IT-TEC-001', type:'Teclado',   brand:'Logitech',  model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Mouse para operacion central',                    condition:'',      notes:null },
  { tag:'PE1H-IT-MOU-002', type:'Mouse',     brand:'Logitech',  model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Mouse para Tvs',                                  condition:'',      notes:null },
  { tag:'PE1H-IT-MON-001', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Foreman',                                   condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-002', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Fortigate',                                 condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-003', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Grafana',                                   condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-004', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-005', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-006', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-007', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-008', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-009', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-010', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Scada',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-011', type:'Monitor',   brand:'HikVision', model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Pools',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-012', type:'Monitor',   brand:'HikVision', model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Pools',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-013', type:'Monitor',   brand:'HikVision', model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Pools',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MON-014', type:'Monitor',   brand:'HikVision', model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:'Windows 10 Enterprise',  status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:'Vista Pools',                                     condition:'Bueno', notes:null },
  { tag:'PE1H-IT-PC-005',  type:'PC',        brand:'Desktop',   model:'Z590-A PRO(MS7D09)',    sn:'07D0912_L51E666517',    macEth:'5C:62:8B:24:6E:06',        macWifi:'D8:BB:C1:47:82:F7', os:'Windows 10 Pro',   status:'Asignado',   assignedTo:'Lorenzo Antonio Martinez Ferreira',        dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'Bueno', notes:'Posee dos NICs' },
  { tag:'PE1H-IT-TEC-002', type:'Teclado',   brand:'Logitech',  model:'K220',                  sn:'2437LOK096E8',          macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Lorenzo Antonio Martinez Ferreira',        dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'Bueno', notes:null },
  { tag:'PE1H-IT-MOU-003', type:'Mouse',     brand:'Logitech',  model:'M150',                  sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Lorenzo Antonio Martinez Ferreira',        dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'Bueno', notes:null },
  { tag:'PE1H-IT-PC-006',  type:'PC',        brand:'Desktop',   model:'Z590-A PRO(MS7D09)',    sn:'07D0912_L61E301558',    macEth:'5C:62:8B:24:57:DD',        macWifi:'D8:BB:C1:4B:88:15', os:'Windows 11 Pro',   status:'Asignado',   assignedTo:'Jose Mariano Ruiz Diaz Noguera',            dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'Bueno', notes:'Posee dos NICs' },
  { tag:'PE1H-IT-MOU-004', type:'Mouse',     brand:'Logitech',  model:'K220',                  sn:'2428SC1064U8',          macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Jose Mariano Ruiz Diaz Noguera',            dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'',      notes:null },
  { tag:'PE1H-IT-TEC-003', type:'Teclado',   brand:'Logitech',  model:'M150',                  sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Jose Mariano Ruiz Diaz Noguera',            dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'',      notes:null },
  { tag:'PE1H-IT-PC-007',  type:'PC',        brand:'Desktop',   model:'NUC10i3FNK',            sn:'G6FN14400ELK',          macEth:null,                       macWifi:null,          os:'Windows 10 Pro',         status:'Asignado',   assignedTo:'Mantenimiento Data Center - Hernandarias',  dept:'Mantenimiento', loc:'NOC',      details:'Vista Scada Local',                               condition:'',      notes:null },
  { tag:'PE1H-IT-PC-008',  type:'PC',        brand:'Desktop',   model:'NUC10i3FNK',            sn:'G6FN14400ELJ',          macEth:null,                       macWifi:null,          os:'Windows 11 Pro',         status:'Asignado',   assignedTo:'Mantenimiento Data Center - Hernandarias',  dept:'Mantenimiento', loc:'NOC',      details:'Operaciones basicas subestacion',                 condition:'',      notes:null },
  { tag:'PE1H-IT-MOU-005', type:'Mouse',     brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Mantenimiento Data Center - Hernandarias',  dept:'Mantenimiento', loc:'NOC',      details:'Mouse para PC Scada Local',                       condition:'',      notes:null },
  { tag:'PE1H-IT-TEC-004', type:'Teclado',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Mantenimiento Data Center - Hernandarias',  dept:'Mantenimiento', loc:'NOC',      details:'Teclado para PC Scada',                           condition:'',      notes:null },
  { tag:'PE1H-IT-MOU-006', type:'Mouse',     brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Mantenimiento Data Center - Hernandarias',  dept:'Mantenimiento', loc:'NOC',      details:'Mouse para Pc de operacion basica subestacion',   condition:'',      notes:null },
  { tag:'PE1H-IT-TEC-005', type:'Teclado',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Mantenimiento Data Center - Hernandarias',  dept:'Mantenimiento', loc:'NOC',      details:'Teclado para Pc de operacion basica subestacion', condition:'',      notes:null },
  { tag:'PE1H-IT-NB-001',  type:'Notebook',  brand:'Acer',      model:'Aspire 3',              sn:'NXADDAAOOM34101C7C3400', macEth:null,                      macWifi:null,          os:'Windows 11 Home',        status:'Asignado',   assignedTo:'Jorge Caballero',                          dept:'Mantenimiento', loc:'NOC',      details:'NB para visualizacion de datos de transformadores', condition:'',    notes:null },
  { tag:'PE1H-IT-NB-002',  type:'Notebook',  brand:'Lenovo',    model:'Idea Pad flex5 16iru8', sn:'PW08C0E7',              macEth:null,                       macWifi:null,          os:'Windows 11 Home',        status:'Asignado',   assignedTo:'Jorge Caballero',                          dept:'Mantenimiento', loc:'NOC',      details:'NB para operaciones basicas de subestacion',      condition:'',      notes:null },
  { tag:'PE1H-IT-PC-009',  type:'PC',        brand:'Desktop',   model:'TUF GAMING 50-PLUS',    sn:'230418920000661',        macEth:null,                      macWifi:null,          os:'Windows 11 Pro',         status:'Asignado',   assignedTo:'Monitoring and Security Unit Hernandarias', dept:'Facility',    loc:'MsU',         details:'Monitoreo de camaras',                            condition:'',      notes:null },
  { tag:'PE1H-IT-PC-010',  type:'PC',        brand:'Desktop',   model:'Z590-A PRO(MS7D09)',    sn:'07D0912_L51E148573',     macEth:null,                      macWifi:null,          os:'Windows 11 Pro',         status:'Asignado',   assignedTo:'Monitoring and Security Unit Hernandarias', dept:'Facility',    loc:'MsU',         details:'Monitoreo de camaras',                            condition:'',      notes:null },
  { tag:'PE1H-IT-PC-011',  type:'PC',        brand:'Desktop',   model:'SYS-E100-9S-E',         sn:'A314959X3C03674',        macEth:null,                      macWifi:null,          os:'Ubuntu',                 status:'Asignado',   assignedTo:'Allan Fernandez',                          dept:'Mining Ops.', loc:'Mining Ops.', details:'Visualizacion de dashboard grafana',              condition:'',      notes:null },
  { tag:'PE1H-IT-MON-015', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Allan Fernandez',                          dept:'Mining Ops.', loc:'Mining Ops.', details:'Visualizacion de dashboard grafana',              condition:'',      notes:null },
  { tag:'PE1H-IT-MON-016', type:'Monitor',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Allan Fernandez',                          dept:'Mining Ops.', loc:'Mining Ops.', details:'Monitor para operaciones',                        condition:'',      notes:null },
  { tag:'PE1H-IT-MON-017', type:'Monitor',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Ronaldo Chavez',                           dept:'Mining Ops.', loc:'Mining Ops.', details:'Monitor para operaciones',                        condition:'',      notes:null },
  { tag:'PE1H-IT-MON-018', type:'Monitor',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Alexis Fernandez',                         dept:'Mining Ops.', loc:'Mining Ops.', details:'Monitor para operaciones',                        condition:'',      notes:null },
  { tag:'PE1H-IT-MON-019', type:'Monitor',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Carlos Obelar',                            dept:'Mining Ops.', loc:'Mining Ops.', details:'Monitor para operaciones',                        condition:'',      notes:null },
  { tag:'PE1H-IT-MON-020', type:'Monitor',   brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Jorge Caballero',                          dept:'Mantenimiento', loc:'NOC',      details:'Visualizacion de datos',                          condition:'',      notes:null },
  { tag:'PE1H-IT-MON-021', type:'Monitor',   brand:'Xiaomi',    model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Jorge Daniel Sanchez Ramirez',             dept:'Mining Ops.', loc:'Mining Ops.', details:'Operaciones de desarrollo de sistemas',           condition:'',      notes:null },
  { tag:'PE1H-IT-IMP-001', type:'Impresora', brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Allan Fernandez',                          dept:'Mining Ops.', loc:'Mining Ops.', details:null,                                              condition:'',      notes:null },
  { tag:'PE1H-IT-IMP-002', type:'Impresora', brand:null,        model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Penguin - Noc Notifications',              dept:'Mining Ops.', loc:'NOC',         details:null,                                              condition:'',      notes:null },
  { tag:'PE1H-IT-MON-022', type:'Monitor',   brand:'Xiaomi',    model:null,                    sn:null,                    macEth:null,                       macWifi:null,          os:null,                     status:'Disponible', assignedTo:null,                                       dept:'Mining Ops.', loc:'Mining Ops.', details:'Monitor disponible',                              condition:'',      notes:null },
  { tag:'PE1H-IT-MON-023', type:'Monitor',   brand:'Samsung',   model:null,                    sn:null,                    macEth:'b0:99:d7:35:e6:aa',        macWifi:null,          os:null,                     status:'Asignado',   assignedTo:'Alexis Fernandez',                         dept:'Mining Ops.', loc:'Networking',  details:'Visualizacion de dashboards',                     condition:'',      notes:null },
  { tag:'PE1H-IT-NB-003',  type:'Notebook',  brand:'Acer',      model:'Nitro V15',             sn:'NHQRYAA00143917867600', macEth:'74:D4:DD:80:9B:95',         macWifi:'C0:BF:BE:08:9A:21', os:'Windows 11 Home', status:'Asignado',  assignedTo:'Networking Ciberseguridad',                dept:'Mining Ops.', loc:'Networking',  details:'Operaciones de red',                              condition:'',      notes:null },
  { tag:'PE1H-IT-NB-004',  type:'Notebook',  brand:'HP',        model:'15-dy2795wm',           sn:'5CD33074ZZ',            macEth:null,                       macWifi:'CC:47:40:B8:98:F7', os:'Windows 11 Home',  status:'Asignado',  assignedTo:'Networking Ciberseguridad',                dept:'Mining Ops.', loc:'Networking',  details:'Visualizacion de dashboards',                     condition:'',      notes:null },
  { tag:'PE1H-IT-NB-005',  type:'Notebook',  brand:'HP',        model:'IdeaPad 3 15ALC6',      sn:'PF39JF2H',              macEth:null,                       macWifi:'00:45:E2:8F:BB:F1', os:'Windows 11 Home',  status:'Disponible', assignedTo:null,                                      dept:'Mining Ops.', loc:'Networking',  details:null,                                              condition:'',      notes:null },
  { tag:'PE1H-IT-NB-006',  type:'Notebook',  brand:'Acer',      model:'A314-36P-3772',         sn:'NXKMKAA00441201E8B2N00', macEth:null,                      macWifi:null,          os:'Windows 11 Home',        status:'Disponible', assignedTo:null,                                      dept:'Mining Ops.', loc:'Networking',  details:null,                                              condition:'',      notes:null },
  { tag:'PE1H-IT-NB-007',  type:'Notebook',  brand:'Acer',      model:'Nitro V15',             sn:'43101793476',           macEth:null,                       macWifi:null,          os:'Windows 11 Home',        status:'Disponible', assignedTo:null,                                      dept:'Mining Ops.', loc:'Networking',  details:null,                                              condition:'',      notes:null },
  { tag:'PE1H-IT-NB-008',  type:'Notebook',  brand:'Lenovo',    model:'20CLS3MQ03',            sn:'PC0AA4B4',              macEth:'50:7B:9D:8B:8F:B1',        macWifi:null,          os:'Windows 10 Pro',         status:'En baja',    assignedTo:null,                                      dept:'Mining Ops.', loc:'Networking',  details:'Notebook de baja por fallos ex micro',            condition:'',      notes:null },
];

const or = (v) => (v == null || v === '' ? null : v);

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // 1. Locations
  console.log('📍 Ubicaciones...');
  for (const loc of LOCATIONS) {
    await prisma.location.upsert({ where: { slug: loc.slug }, update: { name: loc.name, siteCode: loc.siteCode }, create: loc });
  }
  console.log(`   ✅ ${LOCATIONS.length} ubicaciones`);

  // 2. Departments
  console.log('🏢 Departamentos...');
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where:  { slug: dept.slug },
      update: { name: dept.name, parentSlug: dept.parentSlug, type: dept.type },
      create: dept,
    });
  }
  console.log(`   ✅ ${DEPARTMENTS.length} departamentos`);

  // 3. Asset categories
  console.log('🗂️  Categorías de activos...');
  for (const cat of ASSET_CATEGORIES) {
    await prisma.assetCategory.upsert({ where: { slug: cat.slug }, update: { name: cat.name, tagPrefix: cat.tagPrefix, icon: cat.icon }, create: cat });
  }
  console.log(`   ✅ ${ASSET_CATEGORIES.length} categorías`);

  // 4. Users (94 del prototipo)
  console.log('👤 Usuarios...');
  let usersCreated = 0, usersUpdated = 0;
  for (const u of SEED_USERS) {
    const data = {
      email:          u.email,
      name:           u.name,
      nameFirst:      u.nameFirst ?? null,
      nameLast:       u.nameLast ?? null,
      ci:             u.ci ?? null,
      role:           u.role,
      departmentSlug: u.dept ?? null,
      generic:        !!u.generic,
      isActive:       u.isActive !== false,
    };
    const result = await prisma.user.upsert({
      where:  { email: u.email },
      update: data,
      create: { ...data, googleId: null }, // googleId se vincula al primer login real
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) usersCreated++;
    else usersUpdated++;
  }
  console.log(`   ✅ ${usersCreated} creados, ${usersUpdated} actualizados (total: ${SEED_USERS.length})`);

  // Mapa nombre → email (resolución de assignedTo)
  const dbUsers = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const byEmail = Object.fromEntries(dbUsers.map(u => [u.email, u]));
  const byName  = Object.fromEntries(dbUsers.map(u => [u.name,  u]));

  function resolveUser(csvName) {
    if (!csvName) return null;
    const override = NAME_OVERRIDES[csvName];
    if (override && byEmail[override]) return byEmail[override];
    if (byName[csvName]) return byName[csvName];
    return null;
  }

  const alexis = byEmail['alexis.fernandez@penguin.digital'];
  if (!alexis) {
    console.warn('⚠️  Alexis no está cargado; las asignaciones se omiten.');
  }

  // 5. Assets + Assignments
  console.log('\n💻 Activos del CSV...');
  let created = 0, updated = 0, assigned = 0, skippedAssign = 0;

  for (const row of ASSETS_CSV) {
    const categorySlug   = CATEGORY_BY_TYPE[row.type];
    const departmentSlug = DEPT_BY_CSV[row.dept] ?? null;
    const locationSlug   = LOC_BY_CSV[row.loc] ?? null;
    const status         = STATUS_BY_CSV[row.status] ?? 'AVAILABLE';
    const condition      = CONDITION_BY_CSV[row.condition ?? ''] ?? 'GOOD';

    const data = {
      categorySlug,
      brand:           or(row.brand),
      model:           or(row.model),
      serialNumber:    or(row.sn),
      macEth:          or(row.macEth),
      macWifi:         or(row.macWifi),
      operatingSystem: or(row.os),
      status,
      condition,
      departmentSlug,
      locationSlug,
      details:         or(row.details),
      notes:           or(row.notes),
    };

    const existing = await prisma.asset.findUnique({ where: { tag: row.tag } });
    if (existing) {
      await prisma.asset.update({ where: { tag: row.tag }, data });
      updated++;
    } else {
      await prisma.asset.create({ data: { tag: row.tag, ...data } });
      created++;
    }

    if (status === 'ASSIGNED' && row.assignedTo && alexis) {
      const target = resolveUser(row.assignedTo);
      if (!target) { skippedAssign++; continue; }

      const asset = await prisma.asset.findUnique({ where: { tag: row.tag } });
      const open  = await prisma.assetAssignment.findFirst({ where: { assetId: asset.id, returnedAt: null } });
      if (!open) {
        await prisma.assetAssignment.create({
          data: { assetId: asset.id, userId: target.id, assignedById: alexis.id },
        });
        assigned++;
      }
    }
  }

  console.log(`   ✅ ${created} creados, 🔄 ${updated} actualizados, 🔗 ${assigned} asignaciones, ⚠️  ${skippedAssign} sin destinatario`);
  console.log('\n✅ Seed completado.\n');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
