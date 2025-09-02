// npx ts-node oneoffs/vpngate.ts
import * as cheerio from 'cheerio';

interface VpnGateEntry {
	hostName: string;
	ip: string;
	score: number;
	ping: number;
	speed: number;
	country: string;
	sessions: number;
	uptime: number;
	totalUsers: number;
	totalTraffic: number;
	logType: string;
	operator: string;
	message: string;
	openVpnConfigBase64: string;
}

/**
 * Fetch VPNGate iPhone CSV data and parse into entries
 */
async function fetchVpnGateEntries(): Promise<VpnGateEntry[]> {
	const resp = await fetch('https://www.vpngate.net/api/iphone/');
	if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
	const txt = await resp.text();

	const lines = txt.split('\n');
	const entries: VpnGateEntry[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const parts = trimmed.split(',');
		if (parts.length < 15) continue;

		entries.push({
			hostName: parts[0],
			ip: parts[1],
			score: Number(parts[2]),
			ping: Number(parts[3]),
			speed: Number(parts[4]),
			country: parts[5],
			sessions: Number(parts[6]),
			uptime: Number(parts[7]),
			totalUsers: Number(parts[8]),
			totalTraffic: Number(parts[9]),
			logType: parts[10],
			operator: parts[11],
			message: parts[12],
			openVpnConfigBase64: parts.slice(13).join(','), // config may have commas
		});
	}

	return entries;
}

/**
 * Build HTML table using Cheerio
 */
function buildHtmlTable(entries: VpnGateEntry[]): string {
	const $ = cheerio.load('<table></table>');
	const $table = $('table').addClass('wikitable');

	// Header
	const headers = [
		'Host',
		'IP',
		'Sessions',
		'Uptime',
		'Users',
		'Traffic',
		'Log Type',
		'Operator',
		'Message',
	];
	const $thead = $('<thead><tr></tr></thead>');
	headers.forEach((h) => $thead.find('tr').append(`<th>${h}</th>`));
	$table.append($thead);

	// Body
	const $tbody = $('<tbody></tbody>');
	entries.forEach((e) => {
		const $tr = $('<tr></tr>');
		$tr.append(`<td>${e.hostName}</td>`);
		$tr.append(`<td>{{UserAN|${e.ip}}}</td>`);
		$tr.append(`<td>${e.sessions}</td>`);
		$tr.append(`<td>${e.uptime}</td>`);
		$tr.append(`<td>${e.totalUsers}</td>`);
		$tr.append(`<td>${e.totalTraffic}</td>`);
		$tr.append(`<td>${e.logType}</td>`);
		$tr.append(`<td>${e.operator}</td>`);
		$tr.append(`<td>${e.message}</td>`);
		$tbody.append($tr);
	});
	$table.append($tbody);

	return $table.prop('outerHTML') as string;
}

(async () => {
	const entries = await fetchVpnGateEntries();
	const htmlTable = buildHtmlTable(entries);
	console.log(htmlTable);
})();