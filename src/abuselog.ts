import { getMwbot } from './mwbot';



export async function abuselog() {

	const blockLogs = await getBlockLogs();
	if (!blockLogs) return;
	console.log(blockLogs);

	const users = new Set<string>();
	for (const { user } of blockLogs.values()) {
		users.add(user);
	}
	getMwbot().fetch({
		list: 'blocks',
		bkusers: [...users],
		bklimit: 'max'
	}).then((res) => {
		console.dir(res, { depth: null });
	})
	.catch(console.log);

}

interface BlockLog {
	user: string;
	action: string;
	timestamp: string;
}

async function getBlockLogs(): Promise<Map<number, BlockLog> | null> {
	const res = await getMwbot().get({
		list: 'abuselog',
		afllimit: 'max',
		aflprop: 'ids|user|action|result|timestamp'
	}).catch((err) => {
		console.dir(err, { depth: 3 });
		return null;
	});

	const abuselog = res?.query?.abuselog;
	if (!abuselog) return null;

	const rBlock = /(?:^|,)block(?:$|,)/;
	const ret = new Map<number, BlockLog>();
	for (const { id, user, action, result, timestamp } of abuselog) {
		if (
			typeof id === 'number' &&
			typeof user === 'string' &&
			typeof action === 'string' &&
			typeof result === 'string' &&
			typeof timestamp === 'string' &&
			rBlock.test(result)
		) {
			ret.set(id, { user, action, timestamp });
		}
	}

	return !ret.size ? null: ret;
}