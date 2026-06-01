const prisma = require('../../prisma/client');

// ─────────────────────────────────────────────────────────────────────────────
// Datos de referencia
// ─────────────────────────────────────────────────────────────────────────────

const LOCATIONS = [
  { slug: 'noc',         name: 'NOC',         siteCode: 'PE1H' },
  { slug: 'networking',  name: 'Networking',  siteCode: 'PE1H' },
  { slug: 'mining-ops',  name: 'Mining Ops.', siteCode: 'PE1H' },
  { slug: 'msu',         name: 'MSU',         siteCode: 'PE1H' },
];

const DEPARTMENTS = [
  { slug: 'MINING_OPS',                  name: 'Mining Ops',                   parentSlug: null,         type: 'Departamento' },
  { slug: 'MINING_OPS_MINING_TECH',      name: 'Mining Tech',                  parentSlug: 'MINING_OPS', type: 'Equipo' },
  { slug: 'MINING_OPS_MICROELECTRONICS', name: 'Microelectrónica',             parentSlug: 'MINING_OPS', type: 'Equipo' },
  { slug: 'MINING_OPS_NETWORKING_CS',    name: 'Networking & Cybersecurity',   parentSlug: 'MINING_OPS', type: 'Equipo' },
  { slug: 'MINING_OPS_SOFTWARE',         name: 'Software Development',         parentSlug: 'MINING_OPS', type: 'Equipo' },
  { slug: 'MINING_OPS_AUTOMATION',       name: 'Automatización',               parentSlug: 'MINING_OPS', type: 'Equipo' },
  { slug: 'MAINTENANCE',                 name: 'Mantenimiento',                parentSlug: null,         type: 'Departamento' },
  { slug: 'MAINTENANCE_TECH',            name: 'Maintenance Tech',             parentSlug: 'MAINTENANCE', type: 'Equipo' },
  { slug: 'MAINTENANCE_LAB',             name: 'Laboratorio',                  parentSlug: 'MAINTENANCE', type: 'Equipo' },
  { slug: 'MAINTENANCE_SUBSTATION',      name: 'Subestación',                  parentSlug: 'MAINTENANCE', type: 'Equipo' },
  { slug: 'FACILITIES',                  name: 'Facilities',                   parentSlug: null,         type: 'Departamento' },
  { slug: 'FACILITIES_MSU',              name: 'MSU',                          parentSlug: 'FACILITIES', type: 'Equipo' },
  { slug: 'FACILITIES_WAREHOUSE',        name: 'Warehouse',                    parentSlug: 'FACILITIES', type: 'Equipo' },
  { slug: 'FACILITIES_GENERAL_SERVICES', name: 'Servicios Generales',          parentSlug: 'FACILITIES', type: 'Equipo' },
  { slug: 'FACILITIES_SAFETY',           name: 'Safety & Occupational Health', parentSlug: null,         type: 'Departamento' },
  { slug: 'INFRASTRUCTURE',              name: 'Infrastructure',               parentSlug: null,         type: 'Departamento' },
];

const ASSET_CATEGORIES = [
  { slug: 'desktop',  name: 'PC',         tagPrefix: 'PE1H-IT-PC-',  icon: 'Monitor' },
  { slug: 'monitor',  name: 'Monitor',    tagPrefix: 'PE1H-IT-MON-', icon: 'Monitor' },
  { slug: 'notebook', name: 'Notebook',   tagPrefix: 'PE1H-IT-NB-',  icon: 'Laptop' },
  { slug: 'mouse',    name: 'Mouse',      tagPrefix: 'PE1H-IT-MOU-', icon: 'Mouse' },
  { slug: 'keyboard', name: 'Teclado',    tagPrefix: 'PE1H-IT-TEC-', icon: 'Keyboard' },
  { slug: 'printer',  name: 'Impresora',  tagPrefix: 'PE1H-IT-IMP-', icon: 'Printer' },
];

// Usuarios del equipo IT y demás personas del CSV
const USERS = [
  {
    email:     'alexis.fernandez@penguin.digital',
    name:      'Alexis Fernandez',
    role:      'SUPER_ADMIN',
    googleId:  null, // ya existe via OAuth — se actualiza por email
    dept:      'MINING_OPS_NETWORKING_CS',
  },
  {
    email:     'lorenzo.martinez@penguin.digital',
    name:      'Lorenzo Antonio Martinez Ferreira',
    role:      'IT_TECH',
    googleId:  'seed_lorenzo_martinez',
    dept:      'MINING_OPS_NETWORKING_CS',
  },
  {
    email:     'jose.ruizdiaz@penguin.digital',
    name:      'Jose Mariano Ruiz Diaz Noguera',
    role:      'IT_TECH',
    googleId:  'seed_jose_ruizdiaz',
    dept:      'MINING_OPS_NETWORKING_CS',
  },
  {
    email:     'allan.fernandez@penguin.digital',
    name:      'Allan Fernandez',
    role:      'IT_ADMIN',
    googleId:  'seed_allan_fernandez',
    dept:      'MINING_OPS',
  },
  {
    email:     'jorge.caballero@penguin.digital',
    name:      'Jorge Caballero',
    role:      'EMPLOYEE',
    googleId:  'seed_jorge_caballero',
    dept:      'MAINTENANCE',
  },
  {
    email:     'ronaldo.chavez@penguin.digital',
    name:      'Ronaldo Chavez',
    role:      'EMPLOYEE',
    googleId:  'seed_ronaldo_chavez',
    dept:      'MINING_OPS',
  },
  {
    email:     'carlos.obelar@penguin.digital',
    name:      'Carlos Obelar',
    role:      'EMPLOYEE',
    googleId:  'seed_carlos_obelar',
    dept:      'MINING_OPS',
  },
  {
    email:     'jorge.sanchez@penguin.digital',
    name:      'Jorge Daniel Sanchez Ramirez',
    role:      'EMPLOYEE',
    googleId:  'seed_jorge_sanchez',
    dept:      'MINING_OPS_SOFTWARE',
  },
  // Cuentas compartidas / departamentales
  {
    email:     'noc.notifications@penguin.digital',
    name:      'Penguin - NOC Notifications',
    role:      'READ_ONLY',
    googleId:  'seed_noc_notifications',
    dept:      'MINING_OPS',
  },
  {
    email:     'mantenimiento.dc@penguin.digital',
    name:      'Mantenimiento Data Center - Hernandarias',
    role:      'READ_ONLY',
    googleId:  'seed_mantenimiento_dc',
    dept:      'MAINTENANCE',
  },
  {
    email:     'msu.hernandarias@penguin.digital',
    name:      'Monitoring and Security Unit Hernandarias',
    role:      'READ_ONLY',
    googleId:  'seed_msu_hernandarias',
    dept:      'FACILITIES_MSU',
  },
  {
    email:     'networking.cs@penguin.digital',
    name:      'Networking Ciberseguridad',
    role:      'READ_ONLY',
    googleId:  'seed_networking_cs',
    dept:      'MINING_OPS_NETWORKING_CS',
  },
];

// Mapeo de nombre en CSV → email del usuario
const USER_EMAIL_BY_NAME = {
  'Penguin - Noc Notifications':                 'noc.notifications@penguin.digital',
  'Lorenzo Antonio Martinez Ferreira':           'lorenzo.martinez@penguin.digital',
  'Jose Mariano Ruiz Diaz Noguera':              'jose.ruizdiaz@penguin.digital',
  'Mantenimiento Data Center - Hernandarias':    'mantenimiento.dc@penguin.digital',
  'Jorge Caballero':                             'jorge.caballero@penguin.digital',
  'Monitoring and Security Unit Hernandarias':   'msu.hernandarias@penguin.digital',
  'Allan Fernandez':                             'allan.fernandez@penguin.digital',
  'Ronaldo Chavez':                              'ronaldo.chavez@penguin.digital',
  'Alexis Fernandez':                            'alexis.fernandez@penguin.digital',
  'Carlos Obelar':                               'carlos.obelar@penguin.digital',
  'Jorge Daniel Sanchez Ramirez':               'jorge.sanchez@penguin.digital',
  'Networking Ciberseguridad':                   'networking.cs@penguin.digital',
};

// Mapeo tipo CSV → categorySlug
const CATEGORY_BY_TYPE = {
  'PC':         'desktop',
  'Monitor':    'monitor',
  'Notebook':   'notebook',
  'Mouse':      'mouse',
  'Teclado':    'keyboard',
  'Impresora':  'printer',
};

// Mapeo departamento CSV → departmentSlug
const DEPT_BY_CSV = {
  'Mining Ops.': 'MINING_OPS',
  'Mantenimiento': 'MAINTENANCE',
  'Facility':    'FACILITIES',
};

// Mapeo ubicación CSV → locationSlug
const LOC_BY_CSV = {
  'NOC':         'noc',
  'Networking':  'networking',
  'Mining Ops.': 'mining-ops',
  'MsU':         'msu',
  'MSU':         'msu',
};

// Mapeo estado CSV → AssetStatus
const STATUS_BY_CSV = {
  'Asignado':   'ASSIGNED',
  'Disponible': 'AVAILABLE',
  'En baja':    'RETIRED',
};

// Mapeo condición CSV → AssetCondition
const CONDITION_BY_CSV = {
  'Bueno':   'GOOD',
  'Regular': 'FAIR',
  'Dañado':  'DAMAGED',
  '':        'GOOD',
};

// ─────────────────────────────────────────────────────────────────────────────
// Activos del CSV (55 registros)
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

// ─────────────────────────────────────────────────────────────────────────────
// Funciones helper
// ─────────────────────────────────────────────────────────────────────────────

function or(val) {
  return val || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // 1. Locations
  console.log('📍 Creando ubicaciones...');
  for (const loc of LOCATIONS) {
    await prisma.location.upsert({
      where:  { slug: loc.slug },
      update: { name: loc.name },
      create: loc,
    });
  }
  console.log(`   ✅ ${LOCATIONS.length} ubicaciones`);

  // 2. Departments
  console.log('🏢 Creando departamentos...');
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where:  { slug: dept.slug },
      update: { name: dept.name },
      create: dept,
    });
  }
  console.log(`   ✅ ${DEPARTMENTS.length} departamentos`);

  // 3. Asset categories
  console.log('🗂️  Creando categorías de activos...');
  for (const cat of ASSET_CATEGORIES) {
    await prisma.assetCategory.upsert({
      where:  { slug: cat.slug },
      update: { name: cat.name, tagPrefix: cat.tagPrefix },
      create: cat,
    });
  }
  console.log(`   ✅ ${ASSET_CATEGORIES.length} categorías`);

  // 4. Users
  console.log('👤 Creando usuarios...');
  const userMap = {}; // email → id

  for (const u of USERS) {
    if (u.googleId === null) {
      // Alexis ya existe — solo actualizar rol y departamento
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        await prisma.user.update({
          where: { email: u.email },
          data:  { role: u.role, departmentSlug: u.dept },
        });
        userMap[u.email] = existing.id;
        console.log(`   🔄 Actualizado: ${u.name}`);
      }
    } else {
      const user = await prisma.user.upsert({
        where:  { email: u.email },
        update: { name: u.name, role: u.role, departmentSlug: u.dept },
        create: {
          googleId:      u.googleId,
          email:         u.email,
          name:          u.name,
          role:          u.role,
          departmentSlug: u.dept,
        },
      });
      userMap[u.email] = user.id;
      console.log(`   ✅ ${u.name}`);
    }
  }

  // Refrescar el id de Alexis después del update
  const alexis = await prisma.user.findUnique({ where: { email: 'alexis.fernandez@penguin.digital' } });
  if (alexis) userMap['alexis.fernandez@penguin.digital'] = alexis.id;

  // 5. Assets + Assignments
  console.log('\n💻 Importando activos...');
  let created = 0, updated = 0, assigned = 0;

  for (const row of ASSETS_CSV) {
    const categorySlug  = CATEGORY_BY_TYPE[row.type];
    const departmentSlug = DEPT_BY_CSV[row.dept] ?? null;
    const locationSlug  = LOC_BY_CSV[row.loc] ?? null;
    const status        = STATUS_BY_CSV[row.status] ?? 'AVAILABLE';
    const condition     = CONDITION_BY_CSV[row.condition ?? ''] ?? 'GOOD';

    const existing = await prisma.asset.findUnique({ where: { tag: row.tag } });

    if (existing) {
      await prisma.asset.update({
        where: { tag: row.tag },
        data: {
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
        },
      });
      updated++;
    } else {
      await prisma.asset.create({
        data: {
          tag: row.tag,
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
        },
      });
      created++;
    }

    // Crear AssetAssignment si el activo está asignado
    if (status === 'ASSIGNED' && row.assignedTo) {
      const assignedEmail = USER_EMAIL_BY_NAME[row.assignedTo];
      const userId        = assignedEmail ? userMap[assignedEmail] : null;
      const alexisId      = userMap['alexis.fernandez@penguin.digital'];
      const asset         = await prisma.asset.findUnique({ where: { tag: row.tag } });

      if (userId && alexisId && asset) {
        const existingAssignment = await prisma.assetAssignment.findFirst({
          where: { assetId: asset.id, returnedAt: null },
        });
        if (!existingAssignment) {
          await prisma.assetAssignment.create({
            data: {
              assetId:      asset.id,
              userId,
              assignedById: alexisId,
            },
          });
          assigned++;
        }
      }
    }
  }

  console.log(`   ✅ ${created} activos creados`);
  console.log(`   🔄 ${updated} activos actualizados`);
  console.log(`   🔗 ${assigned} asignaciones registradas`);

  console.log('\n✅ Seed completado exitosamente.');
}

main()
  .catch((e) => { console.error('❌ Error en seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
