import { getPrisma } from '../../../src/shared/database/prisma.js';
import type { VetCompanyStatus } from '../../../src/generated/prisma/index.js';

type CompanySeedData = {
  companyCode: string;
  nameBn: string;
  nameEn: string;
  shortNameEn: string;
  licenseNumber?: string;
  status: VetCompanyStatus;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  headOfficeAddress?: string;
  regionCoverage: string[];
  sortOrder: number;
};

const BD_VETERINARY_COMPANIES: CompanySeedData[] = [
  {
    companyCode: 'ACI-VET',
    nameBn: 'এসিআই অ্যানিমেল হেলথ',
    nameEn: 'ACI Animal Health',
    shortNameEn: 'ACI',
    status: 'ACTIVE',
    websiteUrl: 'https://www.aci-bd.com/animal-health',
    headOfficeAddress: 'ACI Centre, 245 Tejgaon Industrial Area, Dhaka-1208',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'BARISAL', 'SYLHET', 'RANGPUR', 'MYMENSINGH'],
    sortOrder: 1,
  },
  {
    companyCode: 'SQUARE-VET',
    nameBn: 'স্কয়ার ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Square Pharmaceuticals Veterinary',
    shortNameEn: 'Square',
    status: 'ACTIVE',
    websiteUrl: 'https://www.squarepharma.com.bd',
    headOfficeAddress: 'Square Centre, 48 Mohakhali C/A, Dhaka-1212',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'BARISAL', 'SYLHET', 'RANGPUR', 'MYMENSINGH'],
    sortOrder: 2,
  },
  {
    companyCode: 'RENATA-VET',
    nameBn: 'রেনাটা অ্যানিমেল হেলথ',
    nameEn: 'Renata Animal Health',
    shortNameEn: 'Renata',
    status: 'ACTIVE',
    websiteUrl: 'https://www.renata-ltd.com',
    headOfficeAddress: 'Renata Limited, Mirpur, Dhaka-1216',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'BARISAL', 'SYLHET', 'RANGPUR', 'MYMENSINGH'],
    sortOrder: 3,
  },
  {
    companyCode: 'SKF-VET',
    nameBn: 'এসকে+এফ ফার্মাসিউটিক্যালস',
    nameEn: 'SK+F Pharmaceuticals',
    shortNameEn: 'SK+F',
    status: 'ACTIVE',
    websiteUrl: 'https://www.skf-pharma.com',
    headOfficeAddress: 'SK+F Bhaban, Tejgaon, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'SYLHET', 'RANGPUR'],
    sortOrder: 4,
  },
  {
    companyCode: 'OPSONIN-VET',
    nameBn: 'অপসোনিন ফার্মা ভেটেরিনারি',
    nameEn: 'Opsonin Pharma Veterinary',
    shortNameEn: 'Opsonin',
    status: 'ACTIVE',
    websiteUrl: 'https://www.opsoninpharma.com',
    headOfficeAddress: 'Opsonin Pharma Ltd, Savar, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'RANGPUR', 'MYMENSINGH'],
    sortOrder: 5,
  },
  {
    companyCode: 'NAVANA-VET',
    nameBn: 'নাভানা ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Navana Pharmaceuticals Veterinary',
    shortNameEn: 'Navana',
    status: 'ACTIVE',
    websiteUrl: 'https://www.navanapharma.com',
    headOfficeAddress: 'Navana Tower, Gulshan, Dhaka-1212',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'BARISAL', 'SYLHET'],
    sortOrder: 6,
  },
  {
    companyCode: 'ACME-VET',
    nameBn: 'একমি ল্যাবরেটরিজ ভেটেরিনারি',
    nameEn: 'ACME Laboratories Veterinary',
    shortNameEn: 'ACME',
    status: 'ACTIVE',
    websiteUrl: 'https://www.acmelabsbd.com',
    headOfficeAddress: 'ACME Centre, Dhanmondi, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'RANGPUR'],
    sortOrder: 7,
  },
  {
    companyCode: 'BEXIMCO-VET',
    nameBn: 'বেক্সিমকো ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Beximco Pharmaceuticals Veterinary',
    shortNameEn: 'Beximco',
    status: 'ACTIVE',
    websiteUrl: 'https://www.beximcopharma.com',
    headOfficeAddress: 'Beximco Industrial Park, Gazipur',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'SYLHET', 'RANGPUR', 'MYMENSINGH'],
    sortOrder: 8,
  },
  {
    companyCode: 'INCEPTA-VET',
    nameBn: 'ইনসেপ্টা ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Incepta Pharmaceuticals Veterinary',
    shortNameEn: 'Incepta',
    status: 'ACTIVE',
    websiteUrl: 'https://www.inceptapharma.com',
    headOfficeAddress: '40 Shahid Tajuddin Ahmed Sarani, Tejgaon, Dhaka-1208',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'BARISAL', 'SYLHET', 'RANGPUR'],
    sortOrder: 9,
  },
  {
    companyCode: 'ESKAYEF-VET',
    nameBn: 'এস্কায়েফ ফার্মাসিউটিক্যালস',
    nameEn: 'Eskayef Pharmaceuticals',
    shortNameEn: 'Eskayef',
    status: 'ACTIVE',
    websiteUrl: 'https://www.skf-pharma.com',
    headOfficeAddress: 'Tongi Industrial Area, Gazipur',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA'],
    sortOrder: 10,
  },
  {
    companyCode: 'TECHNO-VET',
    nameBn: 'টেকনো ড্রাগস ভেটেরিনারি',
    nameEn: 'Techno Drugs Veterinary',
    shortNameEn: 'Techno',
    status: 'ACTIVE',
    headOfficeAddress: 'Narsingdi Industrial Area',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'MYMENSINGH'],
    sortOrder: 11,
  },
  {
    companyCode: 'GLOBE-VET',
    nameBn: 'গ্লোব ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Globe Pharmaceuticals Veterinary',
    shortNameEn: 'Globe',
    status: 'ACTIVE',
    websiteUrl: 'https://www.globepharma.com.bd',
    headOfficeAddress: 'Noakhali',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'BARISAL'],
    sortOrder: 12,
  },
  {
    companyCode: 'POPULAR-VET',
    nameBn: 'পপুলার ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Popular Pharmaceuticals Veterinary',
    shortNameEn: 'Popular',
    status: 'ACTIVE',
    websiteUrl: 'https://www.popularpharma.com.bd',
    headOfficeAddress: 'Tongi Industrial Area, Gazipur',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'RANGPUR'],
    sortOrder: 13,
  },
  {
    companyCode: 'JAYSON-VET',
    nameBn: 'জয়সন ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Jayson Pharmaceuticals Veterinary',
    shortNameEn: 'Jayson',
    status: 'ACTIVE',
    websiteUrl: 'https://www.jaysonpharma.com',
    headOfficeAddress: 'Savar, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA'],
    sortOrder: 14,
  },
  {
    companyCode: 'IBN-VET',
    nameBn: 'ইবনে সিনা ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Ibn Sina Pharmaceuticals Veterinary',
    shortNameEn: 'Ibn Sina',
    status: 'ACTIVE',
    websiteUrl: 'https://www.ibnsinapharma.com',
    headOfficeAddress: 'Salna, Gazipur',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI'],
    sortOrder: 15,
  },
  {
    companyCode: 'HEALTHCARE-VET',
    nameBn: 'হেলথকেয়ার ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Healthcare Pharmaceuticals Veterinary',
    shortNameEn: 'Healthcare',
    status: 'ACTIVE',
    websiteUrl: 'https://www.healthcarepharma.com.bd',
    headOfficeAddress: 'Rajendrapur, Gazipur',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'RANGPUR'],
    sortOrder: 16,
  },
  {
    companyCode: 'GENERAL-VET',
    nameBn: 'জেনারেল ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'General Pharmaceuticals Veterinary',
    shortNameEn: 'General',
    status: 'ACTIVE',
    headOfficeAddress: 'Tongi, Gazipur',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'MYMENSINGH'],
    sortOrder: 17,
  },
  {
    companyCode: 'NIPRO-VET',
    nameBn: 'নিপ্রো জেএমআই ফার্মা ভেটেরিনারি',
    nameEn: 'Nipro JMI Pharma Veterinary',
    shortNameEn: 'Nipro JMI',
    status: 'ACTIVE',
    websiteUrl: 'https://www.niprojmipharma.com',
    headOfficeAddress: 'Savar, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI'],
    sortOrder: 18,
  },
  {
    companyCode: 'DRUG-INT-VET',
    nameBn: 'ড্রাগ ইন্টারন্যাশনাল ভেটেরিনারি',
    nameEn: 'Drug International Veterinary',
    shortNameEn: 'Drug Intl',
    status: 'ACTIVE',
    websiteUrl: 'https://www.drug-international.com',
    headOfficeAddress: 'Gorai, Mirzapur, Tangail',
    regionCoverage: ['DHAKA', 'MYMENSINGH', 'RANGPUR'],
    sortOrder: 19,
  },
  {
    companyCode: 'ARISTOPHARMA-VET',
    nameBn: 'এরিস্টোফার্মা ভেটেরিনারি',
    nameEn: 'Aristopharma Veterinary',
    shortNameEn: 'Aristopharma',
    status: 'ACTIVE',
    websiteUrl: 'https://www.aristopharma.com',
    headOfficeAddress: 'Shampur, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA'],
    sortOrder: 20,
  },
  {
    companyCode: 'RADIANT-VET',
    nameBn: 'র‍্যাডিয়ান্ট ফার্মাসিউটিক্যালস ভেটেরিনারি',
    nameEn: 'Radiant Pharmaceuticals Veterinary',
    shortNameEn: 'Radiant',
    status: 'ACTIVE',
    websiteUrl: 'https://www.radiantpharma.net',
    headOfficeAddress: 'Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG'],
    sortOrder: 21,
  },
  {
    companyCode: 'ORION-VET',
    nameBn: 'অরিয়ন ফার্মা ভেটেরিনারি',
    nameEn: 'Orion Pharma Veterinary',
    shortNameEn: 'Orion',
    status: 'ACTIVE',
    websiteUrl: 'https://www.orionpharmabd.com',
    headOfficeAddress: 'Tejgaon Industrial Area, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI'],
    sortOrder: 22,
  },
  {
    companyCode: 'SANOFI-VET',
    nameBn: 'সানোফি বাংলাদেশ ভেটেরিনারি',
    nameEn: 'Sanofi Bangladesh Veterinary',
    shortNameEn: 'Sanofi',
    status: 'ACTIVE',
    websiteUrl: 'https://www.sanofi.com.bd',
    headOfficeAddress: 'Gulshan, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG'],
    sortOrder: 23,
  },
  {
    companyCode: 'ZOETIS-BD',
    nameBn: 'জোয়েটিস বাংলাদেশ',
    nameEn: 'Zoetis Bangladesh',
    shortNameEn: 'Zoetis',
    status: 'ACTIVE',
    websiteUrl: 'https://www.zoetis.com',
    headOfficeAddress: 'Gulshan, Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA', 'SYLHET', 'RANGPUR'],
    sortOrder: 24,
  },
  {
    companyCode: 'MSD-VET-BD',
    nameBn: 'এমএসডি অ্যানিমেল হেলথ বাংলাদেশ',
    nameEn: 'MSD Animal Health Bangladesh',
    shortNameEn: 'MSD',
    status: 'ACTIVE',
    websiteUrl: 'https://www.msd-animal-health.com',
    headOfficeAddress: 'Dhaka',
    regionCoverage: ['DHAKA', 'CHITTAGONG', 'RAJSHAHI', 'KHULNA'],
    sortOrder: 25,
  },
];

async function seedBdVeterinaryCompanies(): Promise<void> {
  const prisma = getPrisma();
  console.log('Starting Bangladesh Veterinary Company Registry seed...\n');

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const company of BD_VETERINARY_COMPANIES) {
    const existing = await prisma.vetCompany.findUnique({
      where: { companyCode: company.companyCode },
    });

    if (existing) {
      await prisma.vetCompany.update({
        where: { companyCode: company.companyCode },
        data: {
          nameBn: company.nameBn,
          nameEn: company.nameEn,
          shortNameEn: company.shortNameEn,
          status: company.status,
          websiteUrl: company.websiteUrl ?? null,
          headOfficeAddress: company.headOfficeAddress ?? null,
          regionCoverageJson: company.regionCoverage,
          sortOrder: company.sortOrder,
        },
      });
      updated++;
      console.log(`  Updated: ${company.companyCode} (${company.nameEn})`);
    } else {
      await prisma.vetCompany.create({
        data: {
          companyCode: company.companyCode,
          nameBn: company.nameBn,
          nameEn: company.nameEn,
          shortNameEn: company.shortNameEn,
          licenseNumber: company.licenseNumber ?? null,
          status: company.status,
          contactEmail: company.contactEmail ?? null,
          contactPhone: company.contactPhone ?? null,
          websiteUrl: company.websiteUrl ?? null,
          headOfficeAddress: company.headOfficeAddress ?? null,
          regionCoverageJson: company.regionCoverage,
          sortOrder: company.sortOrder,
          isVerified: false,
        },
      });
      created++;
      console.log(`  Created: ${company.companyCode} (${company.nameEn})`);
    }
  }

  console.log(`\nSeed complete: ${created} created, ${updated} updated, ${skipped} skipped`);

  const total = await prisma.vetCompany.count();
  console.log(`Total companies in registry: ${total}`);
}

seedBdVeterinaryCompanies()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
