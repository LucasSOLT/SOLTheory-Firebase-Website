// ============================================================================
// lib/job-roles.ts
//
// Comprehensive, searchable list of job roles across all industries.
// Used in the sign-up form and profile settings.
// Users can also type custom roles if theirs isn't listed.
// ============================================================================

/**
 * Grouped job roles by industry for the searchable dropdown.
 * When displayed, the groups act as optgroup headers.
 * The search filters across all groups simultaneously.
 */
export const JOB_ROLES_BY_INDUSTRY: Record<string, string[]> = {
  'Healthcare & Clinical': [
    'Registered Nurse (RN)',
    'Licensed Practical Nurse (LPN)',
    'Nurse Practitioner (NP)',
    'Physician',
    'Physician Assistant (PA)',
    'Medical Assistant',
    'Clinical Director',
    'Clinical Supervisor',
    'Director of Nursing',
    'Charge Nurse',
    'Pharmacist',
    'Pharmacy Technician',
    'Physical Therapist',
    'Occupational Therapist',
    'Speech-Language Pathologist',
    'Respiratory Therapist',
    'Radiologic Technologist',
    'Surgical Technologist',
    'Phlebotomist',
    'Lab Technician',
    'Medical Records Specialist',
    'Health Information Technician',
    'Patient Care Coordinator',
    'Patient Navigator',
    'Medical Social Worker',
    'Dietitian / Nutritionist',
    'Paramedic / EMT',
    'Home Health Aide',
    'Certified Nursing Assistant (CNA)',
  ],

  'Behavioral Health & Recovery': [
    'Peer Recovery Coach',
    '1099 Peer Recovery Coach',
    'Peer Recovery Specialist',
    'Certified Peer Support Specialist',
    'Substance Abuse Counselor',
    'Licensed Clinical Social Worker (LCSW)',
    'Licensed Professional Counselor (LPC)',
    'Licensed Marriage & Family Therapist (LMFT)',
    'Behavioral Health Technician',
    'Qualified Behavioral Health Associate (QBHA)',
    'Qualified Mental Health Professional (QMHP)',
    'Crisis Intervention Specialist',
    'Case Manager',
    'Care Coordinator',
    'Intake Coordinator',
    'Intake & Admissions Coordinator',
    'Discharge Planner',
    'Rehabilitation Specialist',
    'Community Health Worker',
    'Prevention Specialist',
    'Program Director',
    'Clinical Program Manager',
    'Recovery House Manager',
    'Residential Advisor',
    'Detox Technician',
    'MAT Coordinator',
    'Harm Reduction Specialist',
    'Outreach Worker',
    'Wellness Coach',
    'Life Coach',
  ],

  'Administration & Operations': [
    'Executive Director',
    'Chief Executive Officer (CEO)',
    'Chief Operating Officer (COO)',
    'Chief Financial Officer (CFO)',
    'Chief Technology Officer (CTO)',
    'Chief Marketing Officer (CMO)',
    'Chief Human Resources Officer (CHRO)',
    'Vice President',
    'Director of Operations',
    'Operations Manager',
    'Office Manager',
    'Office Administrator',
    'Administrative Assistant',
    'Executive Assistant',
    'Receptionist',
    'Front Desk Coordinator',
    'Facilities Manager',
    'Compliance Officer',
    'Quality Assurance Specialist',
    'Risk Manager',
    'Policy Analyst',
    'Grant Writer',
    'Grant Manager',
    'Fundraising Coordinator',
    'Development Director',
  ],

  'Human Resources': [
    'HR Director',
    'HR Manager',
    'HR Generalist',
    'HR Coordinator',
    'Recruiter',
    'Talent Acquisition Specialist',
    'Training & Development Manager',
    'Learning & Development Specialist',
    'Compensation & Benefits Analyst',
    'Payroll Specialist',
    'Employee Relations Manager',
    'Onboarding Specialist',
    'Organizational Development Consultant',
    'Diversity & Inclusion Officer',
    'Labor Relations Specialist',
  ],

  'Finance & Accounting': [
    'Accountant',
    'Staff Accountant',
    'Senior Accountant',
    'Controller',
    'Bookkeeper',
    'Accounts Payable Specialist',
    'Accounts Receivable Specialist',
    'Financial Analyst',
    'Budget Analyst',
    'Billing Specialist',
    'Revenue Cycle Manager',
    'Tax Preparer',
    'Auditor',
    'Treasury Analyst',
    'Claims Processor',
  ],

  'Information Technology': [
    'Software Engineer',
    'Full-Stack Developer',
    'Frontend Developer',
    'Backend Developer',
    'Mobile Developer',
    'DevOps Engineer',
    'Site Reliability Engineer (SRE)',
    'Cloud Architect',
    'Data Engineer',
    'Data Scientist',
    'Machine Learning Engineer',
    'AI / ML Researcher',
    'Database Administrator',
    'Systems Administrator',
    'Network Administrator',
    'IT Support Specialist',
    'Help Desk Technician',
    'Cybersecurity Analyst',
    'Security Engineer',
    'IT Director',
    'IT Manager',
    'QA Engineer / Tester',
    'Technical Writer',
    'Product Manager',
    'UX / UI Designer',
    'Scrum Master',
    'Business Analyst',
  ],

  'Sales & Marketing': [
    'Sales Representative',
    'Account Executive',
    'Account Manager',
    'Sales Manager',
    'Business Development Representative',
    'Business Development Manager',
    'Marketing Manager',
    'Marketing Coordinator',
    'Digital Marketing Specialist',
    'Content Marketing Manager',
    'Social Media Manager',
    'SEO Specialist',
    'Brand Manager',
    'Public Relations Specialist',
    'Communications Director',
    'Advertising Manager',
    'Copywriter',
    'Graphic Designer',
    'Creative Director',
    'Market Research Analyst',
    'Customer Success Manager',
    'Partnership Manager',
  ],

  'Education & Training': [
    'Teacher',
    'Professor',
    'Adjunct Instructor',
    'Special Education Teacher',
    'School Counselor',
    'School Psychologist',
    'Academic Advisor',
    'Tutor',
    'Curriculum Developer',
    'Instructional Designer',
    'Training Coordinator',
    'Education Program Manager',
    'Dean',
    'Principal',
    'Superintendent',
    'Librarian',
    'Teaching Assistant',
    'Research Assistant',
  ],

  'Legal': [
    'Attorney / Lawyer',
    'Paralegal',
    'Legal Assistant',
    'Legal Secretary',
    'Compliance Analyst',
    'Contract Specialist',
    'Mediator',
    'Legal Counsel',
    'Court Reporter',
    'Victim Advocate',
  ],

  'Construction & Skilled Trades': [
    'General Contractor',
    'Construction Manager',
    'Project Manager',
    'Site Superintendent',
    'Foreman',
    'Carpenter',
    'Electrician',
    'Plumber',
    'HVAC Technician',
    'Welder',
    'Painter',
    'Roofer',
    'Mason / Bricklayer',
    'Heavy Equipment Operator',
    'Surveyor',
    'Civil Engineer',
    'Structural Engineer',
    'Safety Officer',
    'Estimator',
    'Inspector',
    'Maintenance Technician',
    'Landscaper',
  ],

  'Manufacturing & Warehousing': [
    'Production Manager',
    'Plant Manager',
    'Manufacturing Engineer',
    'Quality Control Inspector',
    'Machine Operator',
    'Assembly Line Worker',
    'Warehouse Manager',
    'Warehouse Associate',
    'Forklift Operator',
    'Shipping & Receiving Clerk',
    'Inventory Specialist',
    'Supply Chain Manager',
    'Procurement Specialist',
    'Logistics Coordinator',
  ],

  'Hospitality & Food Service': [
    'Restaurant Manager',
    'Chef / Head Cook',
    'Sous Chef',
    'Line Cook',
    'Server / Waitstaff',
    'Bartender',
    'Host / Hostess',
    'Hotel Manager',
    'Front Desk Agent',
    'Housekeeper',
    'Event Coordinator',
    'Catering Manager',
    'Food Safety Manager',
    'Barista',
  ],

  'Transportation & Logistics': [
    'Truck Driver',
    'Delivery Driver',
    'Fleet Manager',
    'Dispatcher',
    'Route Planner',
    'Pilot',
    'Bus Driver',
    'Train Conductor',
    'Shipping Manager',
    'Customs Broker',
    'Import / Export Specialist',
  ],

  'Government & Public Service': [
    'City Manager',
    'City Planner',
    'Public Health Officer',
    'Social Services Director',
    'Probation Officer',
    'Parole Officer',
    'Police Officer',
    'Firefighter',
    'Emergency Management Director',
    'Building Inspector',
    'Environmental Specialist',
    'Public Affairs Officer',
    'Legislative Aide',
  ],

  'Nonprofit & Social Services': [
    'Nonprofit Executive Director',
    'Program Director',
    'Program Coordinator',
    'Volunteer Coordinator',
    'Community Organizer',
    'Advocacy Director',
    'Shelter Manager',
    'Youth Worker',
    'Family Services Coordinator',
    'Housing Counselor',
    'Employment Specialist',
    'Benefits Navigator',
    'Case Aide',
  ],

  'Real Estate & Property': [
    'Real Estate Agent',
    'Real Estate Broker',
    'Property Manager',
    'Leasing Consultant',
    'Appraiser',
    'Mortgage Loan Officer',
    'Real Estate Attorney',
    'HOA Manager',
  ],

  'Other / General': [
    'Intern',
    'Apprentice',
    'Consultant',
    'Contractor',
    'Freelancer',
    'Volunteer',
    'Board Member',
    'Advisor',
    'Fellow',
    'Researcher',
    'Analyst',
    'Coordinator',
    'Specialist',
    'Technician',
    'Supervisor',
    'Manager',
    'Director',
    'Owner / Founder',
  ],
};

/**
 * Pre-computed flat list of all roles for quick searching.
 */
export const ALL_JOB_ROLES: string[] = Object.values(JOB_ROLES_BY_INDUSTRY).flat();

/**
 * Common certifications in behavioral health, healthcare, and professional services.
 * Users can also add custom certifications not in this list.
 */
export const COMMON_CERTIFICATIONS: string[] = [
  // Behavioral Health & Recovery
  'CPRC (Certified Peer Recovery Coach)',
  'CPRS (Certified Peer Recovery Specialist)',
  'QBHA (Qualified Behavioral Health Associate)',
  'QMHP (Qualified Mental Health Professional)',
  'CADC (Certified Alcohol & Drug Counselor)',
  'CASAC (Credentialed Alcoholism & Substance Abuse Counselor)',
  'MAC (Master Addictions Counselor)',
  'NCAC (National Certified Addictions Counselor)',
  'CPS (Certified Prevention Specialist)',
  'CHW (Certified Community Health Worker)',
  'WRAP Facilitator',
  'Mental Health First Aid Certified',
  'Naloxone / Narcan Trained',
  'Motivational Interviewing Certified',
  'Trauma-Informed Care Certified',

  // Clinical / Therapy
  'LCSW (Licensed Clinical Social Worker)',
  'LPC (Licensed Professional Counselor)',
  'LMFT (Licensed Marriage & Family Therapist)',
  'LMHC (Licensed Mental Health Counselor)',
  'LCDC (Licensed Chemical Dependency Counselor)',
  'NCC (National Certified Counselor)',
  'BCBA (Board Certified Behavior Analyst)',

  // Nursing & Medical
  'RN (Registered Nurse)',
  'LPN / LVN (Licensed Practical / Vocational Nurse)',
  'CNA (Certified Nursing Assistant)',
  'APRN (Advanced Practice Registered Nurse)',
  'BLS (Basic Life Support)',
  'ACLS (Advanced Cardiovascular Life Support)',
  'PALS (Pediatric Advanced Life Support)',
  'CPR Certified',
  'EMT-Basic',
  'EMT-Paramedic',
  'Phlebotomy Certified',
  'Medical Assistant Certified (CMA)',

  // HIPAA & Compliance
  'HIPAA Certified',
  '42 CFR Part 2 Trained',
  'OSHA 10-Hour',
  'OSHA 30-Hour',

  // General Professional
  'PMP (Project Management Professional)',
  'Six Sigma Green Belt',
  'Six Sigma Black Belt',
  'SHRM-CP (HR Certified Professional)',
  'PHR (Professional in Human Resources)',
  'CPA (Certified Public Accountant)',
  'Notary Public',
  'CDL (Commercial Driver\'s License)',
  'ServSafe Certified',
  'CompTIA A+',
  'CompTIA Security+',
  'AWS Certified',
  'Google Cloud Certified',
  'Microsoft Azure Certified',

  // First Aid & Safety
  'First Aid Certified',
  'AED Certified',
  'Bloodborne Pathogens Trained',
  'Mandated Reporter Trained',
  'Crisis Prevention Institute (CPI)',
  'Safe Zone Trained',
];

/**
 * Filters job roles based on a search query.
 * Returns matches grouped by industry.
 */
export function searchJobRoles(query: string): Record<string, string[]> {
  if (!query.trim()) return JOB_ROLES_BY_INDUSTRY;
  const q = query.toLowerCase().trim();
  const results: Record<string, string[]> = {};
  for (const [industry, roles] of Object.entries(JOB_ROLES_BY_INDUSTRY)) {
    const matches = roles.filter(r => r.toLowerCase().includes(q));
    if (matches.length > 0) results[industry] = matches;
  }
  return results;
}

/**
 * Filters certifications based on a search query.
 */
export function searchCertifications(query: string): string[] {
  if (!query.trim()) return COMMON_CERTIFICATIONS;
  const q = query.toLowerCase().trim();
  return COMMON_CERTIFICATIONS.filter(c => c.toLowerCase().includes(q));
}
