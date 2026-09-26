#!/usr/bin/env node
/**
 * Archive the official reference sources that underpin the dashboard's
 * production and staging datasets. This deliberately archives evidence; it
 * does not convert a source into dashboard data or alter a release.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveRoot = path.join(repoRoot, 'data', 'raw', 'source_archive');
const manifestPath = path.join(archiveRoot, 'manifest.json');
const retrievedAt = new Date().toISOString();

const sources = [
  {
    id: 'ncrb_pib_latest_report_2024', path: 'ncrb/pib_latest_ncrb_report_2024.html',
    source_url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2287039&lang=1&reg=1',
    publication_date: null, agency: 'Press Information Bureau / Ministry of Home Affairs',
    reference_period: 'Crime in India 2024', notes: 'Official release-status reference; it is not a district-level extract.', allow_unavailable: true
  },
  // The district-wise NCRB workbooks are the actual evidence behind every crime figure on the
  // dashboard. They were previously cited by URL only, so nothing in the repository pinned the
  // bytes those numbers were read from; NCRB has reshuffled /uploads/ paths before.
  // The 2024 IPC workbook is titled "Districtwise IPC/BNS Crimes - 2024" and its Delhi block
  // reproduces the dashboard's totalIPC2024 exactly for all 15 law-and-order districts.
  {
    id: 'ncrb_districtwise_ipc_2024', path: 'ncrb/districtwise_ipc_bns_crimes_2024.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise IPC/BNS crimes, 2024',
    notes: 'Source for theft2024, robbery2024, burglary2024 and totalIPC2024. Excludes the nine non-geographic Delhi rows (Crime Branch, EOW, IGI Airport, Metro, Railway, Spl Cell, SPUWAC, Vigilance) that are not law-and-order districts.'
  },
  {
    id: 'ncrb_districtwise_ipc_2023', path: 'ncrb/districtwise_ipc_crimes_2023.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise IPC crimes, 2023',
    notes: 'Source for theft, robbery, burglary and totalIPC (the dashboard’s 2023 baseline year).'
  },
  {
    id: 'ncrb_districtwise_ipc_2022', path: 'ncrb/districtwise_ipc_crimes_2022.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise IPC crimes, 2022',
    notes: 'Source for the 2022 comparison year, and the known-correct totals used to validate the 2017-2021 historical reconstruction.'
  },
  {
    id: 'ncrb_districtwise_sll_2024', path: 'ncrb/districtwise_sll_crimes_2024.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise SLL crimes, 2024', notes: 'Source for totalSLL2024.'
  },
  {
    id: 'ncrb_districtwise_sll_2023', path: 'ncrb/districtwise_sll_crimes_2023.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise SLL crimes, 2023', notes: 'Source for totalSLL.'
  },
  {
    id: 'ncrb_districtwise_sll_2022', path: 'ncrb/districtwise_sll_crimes_2022.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise SLL crimes, 2022',
    notes: 'Source for totalSLL2022. One record misfiled under Delhi (district_code 553, actually Lakshadweep) is excluded by the district-name matcher.'
  },
  {
    id: 'ncrb_districtwise_caw_2024', path: 'ncrb/districtwise_crime_against_women_2024.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise crime against women, 2024', notes: 'Source for crimeAgainstWomen2024.'
  },
  {
    id: 'ncrb_districtwise_caw_2023', path: 'ncrb/districtwise_crime_against_women_2023.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise crime against women, 2023', notes: 'Source for crimeAgainstWomen.'
  },
  {
    id: 'ncrb_districtwise_caw_2022', path: 'ncrb/districtwise_crime_against_women_2022.xlsx',
    source_url: 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx',
    publication_date: null, agency: 'National Crime Records Bureau',
    reference_period: 'Crime in India, district-wise crime against women, 2022', notes: 'Source for crimeAgainstWomen2022.'
  },
  {
    id: 'delhi_police_newsletters_index', path: 'delhi_police/newsletters_index_2025_2026.html',
    source_url: 'https://delhipolice.gov.in/newsletters', publication_date: null,
    agency: 'Delhi Police', reference_period: '2025-2026 index',
    notes: 'Supplementary citywide agency material; not assumed comparable with NCRB district series.'
  },
  {
    id: 'delhi_police_gazette_index', path: 'delhi_police/gazette_index_2025_2026.html',
    source_url: 'https://delhipolice.gov.in/Gazette', publication_date: null,
    agency: 'Delhi Police', reference_period: '2025-2026 index',
    notes: 'Index page retained for discovery and later, explicitly reviewed extraction.'
  },
  {
    id: 'traffic_police_report_index', path: 'traffic_police/crash_report_index.html',
    source_url: 'https://traffic.delhipolice.gov.in/', publication_date: null,
    agency: 'Delhi Traffic Police', reference_period: 'Latest published report index',
    notes: 'Do not infer a report year from the landing page. Downloaded reports require separate validation.'
  },
  {
    id: 'irad_new_delhi_2025_index', path: 'irad/new_delhi_2025/index.html',
    source_url: 'https://dmnewdelhi.delhi.gov.in/integrated-road-accident-cases-month-wise/', publication_date: null,
    agency: 'District Administration New Delhi', reference_period: '2025',
    notes: 'Official iRAD/eDAR landing page. Station or district totals must retain this source scope.'
  },
  {
    id: 'irad_new_delhi_ps_index', path: 'irad/new_delhi_police_station/index.html',
    source_url: 'https://dmnewdelhi.delhi.gov.in/police-station-wise-accident-cases/', publication_date: null,
    agency: 'District Administration New Delhi', reference_period: 'Available years on retrieval',
    notes: 'Official police-station crash index; separate from a 15-police-district dashboard crosswalk.'
  },
  {
    id: 'irad_north_west_2025_index', path: 'irad/north_west_2025/index.html',
    source_url: 'https://dmnorthwest.delhi.gov.in/irad-edar-north-west-delhi/', publication_date: null,
    agency: 'District Administration North West Delhi', reference_period: '2025',
    notes: 'Official iRAD/eDAR landing page.'
  },
  {
    id: 'delhi_police_manual_1_2026', path: 'delhi_police/manual_1_2026-05-22.pdf',
    source_url: 'https://delhipolice.gov.in/RTImanualFiles/71346_Manual%201.pdf', publication_date: '2026-05-22',
    agency: 'Delhi Police', reference_period: 'Police structure as updated 2026-05-22',
    notes: 'Authoritative reference for a reviewed 15-police-district / police-station crosswalk; not an automatically applied mapping.'
  },
  {
    id: 'mcd_final_delimitation_2022', path: 'wards/mcd_final_delimitation_2022.pdf',
    source_url: 'https://sec.delhi.gov.in/sites/default/files/SCERT/circulars-orders/delimitation_notification_english.pdf', publication_date: '2022-10-17',
    agency: 'State Election Commission, NCT of Delhi', reference_period: 'MCD wards, 2022 delimitation',
    notes: 'Current 250-ward reference. It is not interchangeable with legacy 290 wards.'
  },
  {
    id: 'sec_ward_maps_241_250', path: 'wards/sec_ward_maps_241_250_index.html',
    source_url: 'https://sec.delhi.gov.in/sec/final-individual-maps-newly-delimited-wards-241-250-maps', publication_date: null,
    agency: 'State Election Commission, NCT of Delhi', reference_period: 'MCD ward maps, wards 241-250',
    notes: 'Official map index retained as evidence and for follow-on, bounded downloading.'
  },
  {
    id: 'excise_preferred_vends_2025_10_09', path: 'excise/preferred_vends_2025-10-09.pdf',
    source_url: 'https://excise.delhi.gov.in/sites/default/files/Excise/circulars-orders/circular_p10.pdf', publication_date: '2025-10-09',
    agency: 'Delhi Excise Department', reference_period: 'Preferred-vend circular snapshot',
    notes: 'A designated/preferred-vend circular, not a complete inventory of all liquor vends.'
  }
];

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function filenameFromPath(relativePath) { return path.posix.basename(relativePath); }
function isPdf(bytes) { return bytes.subarray(0, 4).toString('ascii') === '%PDF'; }

async function download(source) {
  const destination = path.join(archiveRoot, source.path);
  const temporary = `${destination}.incoming`;
  await mkdir(path.dirname(destination), { recursive: true });
  const response = await fetch(source.source_url, {
    headers: { 'user-agent': 'DelhiCrimeDashboard-source-archive/1.0 (+https://github.com/ayushthaosen-gif/DelhiCrimeDashboard)' },
    redirect: 'follow', signal: AbortSignal.timeout(60000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('Empty response');
  if (source.path.endsWith('.pdf') && !isPdf(bytes)) throw new Error('Expected a PDF but received another format');
  await writeFile(temporary, bytes);
  await rename(temporary, destination);
  return {
    ...source,
    retrieved_at: retrievedAt,
    resolved_url: response.url,
    sha256: sha256(bytes),
    mime_type: response.headers.get('content-type') || (source.path.endsWith('.pdf') ? 'application/pdf' : 'text/html'),
    original_filename: filenameFromPath(source.path),
    content_length: bytes.length,
    status: 'archived'
  };
}

async function main() {
  const offline = process.argv.includes('--offline');
  await mkdir(archiveRoot, { recursive: true });
  const entries = [];
  for (const source of sources) {
    try {
      if (offline) {
        const localPath = path.join(archiveRoot, source.path);
        const bytes = await readFile(localPath);
        entries.push({ ...source, retrieved_at: null, resolved_url: null, sha256: sha256(bytes), mime_type: source.path.endsWith('.pdf') ? 'application/pdf' : 'text/html', original_filename: filenameFromPath(source.path), content_length: bytes.length, status: 'validated_offline' });
      } else {
        entries.push(await download(source));
      }
    } catch (error) {
      entries.push({ ...source, retrieved_at: null, resolved_url: null, sha256: null, mime_type: null, original_filename: filenameFromPath(source.path), content_length: null, status: source.allow_unavailable ? 'unavailable' : 'failed', error: String(error.message || error) });
    }
  }
  const manifest = { schema_version: '1.0.0', generated_at: new Date().toISOString(), archive_root: 'data/raw/source_archive', sources: entries };
  if (!offline) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const archived = entries.filter((entry) => ['archived', 'validated_offline'].includes(entry.status)).length;
  const unavailable = entries.filter((entry) => entry.status === 'unavailable').length;
  console.log(`Archived or validated ${archived}/${entries.length} official sources; ${unavailable} known unavailable.`);
  for (const entry of entries.filter((item) => item.status === 'failed')) console.error(`${entry.id}: ${entry.error}`);
  process.exitCode = archived === entries.length ? 0 : 1;
}

await main();
