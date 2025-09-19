// npx ts-node src/scripts/blockProxies.ts

import { init } from '../mwbot';
import { scrapeWebpage } from '../lib';
import { IP } from 'ip-wiki';
import { waitForUserAction } from './interactive';
import type { Mwbot, MwbotError } from 'mwbot-ts';

blockProxies(
	4,
	25369,
	'3 years',
	'{{blocked proxy}} <!-- AS25369, Hydra Communications Ltd -->'
);

async function blockProxies(ipVersion: 4 | 6, asn: number, expiry: string, reason: string): Promise<void> {
	const ips = await scrape(ipVersion, asn);
	if (!ips.length) return;

	const input = await waitForUserAction('Do you want to block these IPs? Press Enter to continue, "q" to quit: ');
	if (input !== 'continue') return;

	const mwbot = await init('dragoniez');
	const failed: string[] = [];
	for (const ip of ips) {
		const success = await doBlock(mwbot, ip, expiry, reason);
		if (success) {
			console.log(`Blocked ${ip}.`);
		} else {
			failed.push(ip);
		}
	}

	console.log('Process complete.');
	if (failed.length) {
		console.log('Failed to block the following IPs:', failed);
	}
}

async function scrape(ipVersion: 4 | 6, asn: number): Promise<string[]> {
	const baseUrl = `https://awebanalysis.com/ja/ipv${ipVersion}-as-number-directory/${asn}/`;
	const cidrs: string[] = [];

	// Normalize or split IP into proper CIDRs
	const normalizeIp = (ip: IP): string[] => {
		let targetLen: number | null = null;

		if (ip.version === 4 && ip.getBitLength() < 16) {
			targetLen = 16;
		} else if (ip.version === 6 && ip.getBitLength() < 19) {
			targetLen = 19;
		}

		if (targetLen !== null) {
			return splitCIDR(ip, targetLen).map(ip => ip.sanitize());
		}
		return [ip.sanitize()];
	};

	// FIXME: aWebAnalysis now requires login to navigate through ASN information pages
	let page = 1;
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const $ = await scrapeWebpage(`${baseUrl}${page}/`);
		if (!$) {
			page--;
			break;
		}

		$('table > tbody tr').each((_, tr) => {
			const ipStr = $('td', tr).eq(1).text();
			const ip = IP.newFromText(ipStr);
			if (!ip) {
				console.warn(`Skipping unparsable IP: "${ipStr}"`);
				return;
			}
			cidrs.push(...normalizeIp(ip));
		});

		const nextPageExists = $(`.pagination-container a[href="${baseUrl}${page + 1}/"]`).length > 0;
		if (!nextPageExists) break;
		page++;
	}

	const len = cidrs.length;
	console.log(
		`Collected ${len} ${plural(len, 'CIDR', 'CIDRs')} from ${page} ${plural(page, 'page', 'pages')}:`,
		cidrs
	);

	return cidrs;
}

/**
 * Split an IP CIDR into smaller CIDRs of the given target bit length.
 *
 * @param ip - An IP instance representing the CIDR to split
 * @param targetBitLen - The target prefix length to subdivide into
 * @returns Array of CIDR strings
 */
export function splitCIDR(ip: IP, targetBitLen: number): IP[] {
	let totalBits: number;
	let sep: string;
	if (ip.version === 4) {
		totalBits = 32;
		sep = '.';
	} else {
		totalBits = 128;
		sep = ':';
	}

	const range = ip.getProperties();
	if (targetBitLen < range.bitLen) {
		throw new Error(
			`Target bit length ${targetBitLen} is shorter than current ${range.bitLen}`
		);
	}
	if (targetBitLen === range.bitLen) {
		return [ip]; // already at target length
	}

	// Number of addresses per subdivision
	const blockSize = BigInt(1) << BigInt(totalBits - targetBitLen);

	// Convert first/last arrays into bigint
	const toBigInt = (parts: number[]) => {
		return parts.reduce((acc, part) => (acc << BigInt(8)) + BigInt(part), BigInt(0));
	};
	const fromBigInt = (value: bigint, length: number): number[] => {
		const parts: number[] = [];
		for (let i = 0; i < length; i++) {
			parts.unshift(Number(value & BigInt(0xff)));
			value >>= BigInt(8);
		}
		return parts;
	};

	const start = toBigInt(range.first);
	const end = toBigInt(range.last);

	const result: IP[] = [];
	for (let addr = start; addr <= end; addr += blockSize) {
		let ipParts = fromBigInt(addr, range.first.length) as (number | string)[];
		if (ip.version === 6) {
			ipParts = ipParts.map(part => part.toString(16));
		}
		const cidr = IP.newFromRange(ipParts.join(sep), targetBitLen);
		if (!cidr) throw new Error();
		result.push(cidr);
	}

	return result;
}

function plural(num: number, single: string, multiple: string): string {
	return num === 1 ? single : multiple;
}

async function doBlock(mwbot: Mwbot, ip: string, expiry: string, reason: string, reblock = false): Promise<boolean> {
	try {
		await mwbot.block(ip, {
			expiry,
			reason,
			// Hardblock and overwrite existing blocks
			anononly: false,
			reblock: true
		});
		return true;
	} catch (err) {
		console.log(err);
		if (!reblock && (err as MwbotError).code === 'alreadyblocked') {
			const input = await waitForUserAction(
				`${ip} is already blocked. Do you want to reblock it? Press Enter to continue, "q" to quit: `
			);
			if (input === 'continue') {
				return doBlock(mwbot, ip, expiry, reason, true);
			}
		}
		return false;
	}
}