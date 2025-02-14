import { ApiParams as ApiParamsTMW } from 'types-mediawiki/api_params';
import { XOR } from 'ts-xor';

// Parameter types

/**
 * The API query parameters.
 * @see https://www.mediawiki.org/wiki/API:Main_page
 */
export interface ApiParams extends ApiParamsTMW {

	// Overwrite "action?: string;"
	action?: ApiParamsAction;

	// For action-specific parameters
	[param: string]:
		| string
		| number
		| boolean
		| string[]
		| number[]
		| undefined
		| Date;
}

export type ApiParamsAction =
	| 'abusefiltercheckmatch'
	| 'abusefilterchecksyntax'
	| 'abusefilterevalexpression'
	| 'abusefilterunblockautopromote'
	| 'abuselogprivatedetails'
	| 'acquiretempusername'
	| 'aggregategroups'
	| 'antispoof'
	| 'block'
	| 'centralauthtoken'
	| 'centralnoticecdncacheupdatebanner'
	| 'centralnoticechoicedata'
	| 'centralnoticequerycampaign'
	| 'changeauthenticationdata'
	| 'changecontentmodel'
	| 'checktoken'
	| 'cirrus-config-dump'
	| 'cirrus-mapping-dump'
	| 'cirrus-profiles-dump'
	| 'cirrus-settings-dump'
	| 'clearhasmsg'
	| 'clientlogin'
	| 'communityconfigurationedit'
	| 'compare'
	| 'createaccount'
	| 'createlocalaccount'
	| 'delete'
	| 'deleteglobalaccount'
	| 'discussiontoolsedit'
	| 'discussiontoolsfindcomment'
	| 'discussiontoolsgetsubscriptions'
	| 'discussiontoolssubscribe'
	| 'discussiontoolsthank'
	| 'echocreateevent'
	| 'echomarkread'
	| 'echomarkseen'
	| 'echomute'
	| 'edit'
	| 'editmassmessagelist'
	| 'emailuser'
	| 'expandtemplates'
	| 'featuredfeed'
	| 'feedcontributions'
	| 'feedrecentchanges'
	| 'feedthreads'
	| 'feedwatchlist'
	| 'filerevert'
	| 'flow-parsoid-utils'
	| 'flow'
	| 'flowthank'
	| 'globalblock'
	| 'globalpreferenceoverrides'
	| 'globalpreferences'
	| 'globaluserrights'
	| 'groupreview'
	| 'help'
	| 'imagerotate'
	| 'import'
	| 'jsonconfig'
	| 'languagesearch'
	| 'linkaccount'
	| 'login'
	| 'logout'
	| 'managetags'
	| 'markfortranslation'
	| 'massmessage'
	| 'mergehistory'
	| 'move'
	| 'newslettersubscribe'
	| 'opensearch'
	| 'options'
	| 'paraminfo'
	| 'parse'
	| 'patrol'
	| 'protect'
	| 'purge'
	| 'query'
	| 'removeauthenticationdata'
	| 'resetpassword'
	| 'revisiondelete'
	| 'rollback'
	| 'rsd'
	| 'searchtranslations'
	| 'setglobalaccountstatus'
	| 'setnotificationtimestamp'
	| 'setpagelanguage'
	| 'shortenurl'
	| 'sitematrix'
	| 'spamblacklist'
	| 'streamconfigs'
	| 'strikevote'
	| 'tag'
	| 'templatedata'
	| 'thank'
	| 'threadaction'
	| 'titleblacklist'
	| 'torblock'
	| 'transcodereset'
	| 'translationaids'
	| 'translationreview'
	| 'translationstats'
	| 'ttmserver'
	| 'unblock'
	| 'undelete'
	| 'unlinkaccount'
	| 'upload'
	| 'userrights'
	| 'validatepassword'
	| 'watch'
	| 'webapp-manifest'
	| 'webauthn'
	| 'wikilove';

// Response types

export interface ApiResponse {
	// General properties
	batchcomplete?: boolean;
	continue?: {
		[key: string]: string;
	};
	curtimestamp?: string;
	error?: ApiResponseError;
	errors?: ApiResponseErrors[];
	docref?: string; // Present when "errors" is present
	errorlang?: string;
	limits?: {
		[key: string]: number;
	};
	normalized?: ApiResponseNormalized[];
	parse?: ApiResponseParse;
	requestid?: string;
	servedby?: string;
	uselang?: string;
	warnings?: XOR<ApiResponseWarningsLegacy, ApiResponseWarnings[]>;
	// Action-specific properties
	// edit?: ApiResponseEdit;
	login?: ApiResponseLogin;
	query?: ApiResponseQuery;
}

export interface ApiResponseNormalized {
	fromencoded?: boolean;
	from: string;
	to: string;
}

// Warnings

type PartialRecord<K extends keyof any, T> = {
	[P in K]?: T;
};

/** errorformat=bc */
export type ApiResponseWarningsLegacy = PartialRecord<ApiParamsAction, ApiResponseWarningsObject>;

export type ApiResponseWarnings = {
	code: string;
	module: string;
} & ApiResponseWarningsObject;

type ApiResponseWarningsObject =
	XOR<{
		'*': string;
	}, {
		warnings: string; // formatversion=2
	}>;

// Errors

export type ApiResponseErrors = {
	code: string;
	module: string;
	data?: any[];
} & XOR<
	{html: string;}, // errorformat=html
	{text: string;}, // errorformat=wikitext, errorformat=plaintext
	{key: string; params: string[];} // errorformat=raw
>;

/** errorformat=bc */
export interface ApiResponseError {
	code: string;
	info: string;
	docref?: string;
	details?: any; // script-internal
}

export interface ApiResponseLogin {
	result: string;
	reason?: string;
	lguserid?: number;
	lgusername?: string;
	/** @deprecated */
	token?: string;
}

export interface ApiResponseParse {
	title: string;
	pageid: number;
	revid?: number;
	text?: string;
	langlinks?: {
		lang: string;
		url: string;
		langname: string;
		autonym: string;
		title: string;
	}[];
	categories?: {
		sortkey: string;
		category: string;
		hidden?: boolean;
	}[];
	categorieshtml?: string;
	links?: {
		ns: number;
		title: string;
		exists: boolean;
	}[];
	templates?: {
		ns: number;
		title: string;
		exists: boolean;
	}[];
	images?: string[];
	externallinks?: string[];
	sections?: {
		toclevel: number;
		level: string;
		line: string;
		number: string;
		index: string;
		fromtitle: string;
		byteoffset: number|null;
		anchor: string;
		linkAnchor: string;
		extensionData?: {
			[key: string]: string;
		};
	}[];
	showtoc?: boolean;
	parsewarnings?: unknown[];
	parsewarningshtml?: unknown[];
	displaytitle?: string;
	subtitle?: string;
	headitems?: unknown[];
	headhtml?: string;
	modules?: string[];
	modulescripts?: unknown[];
	modulestyles?: string[];
	jsconfigvars?: {
		[key: string]: any;
	};
	encodedjsconfigvars?: string;
	indicators?: {
		[key: string]: string;
	};
	iwlinks?: {
		prefix: string;
		url: string;
		title: string;
	}[];
	wikitext?: string;
	properties?: {
		[key: string]: string;
	};
	limitreportdata?: Record<string, unknown>[];
	limitreporthtml?: string;
	parsetree?: string;
}

export interface ApiResponseQuery {
	allmessages?: ApiResponseQueryMetaAllmessages[];
	autocreatetempuser?: ApiResponseQueryMetaSiteinfoAutocreatetempuser;
	badrevids?: {
		[key: string]: {
			revid: number;
			missing: boolean;
		};
	};
	dbrepllag?: ApiResponseQueryMetaSiteinfoDbrepllag[];
	defaultoptions?: ApiResponseQueryMetaSiteinfoDefaultoptions;
	extensions?: ApiResponseQueryMetaSiteinfoExtensions[];
	extensiontags?: string[];
	fileextensions?: ApiResponseQueryMetaSiteinfoFileextensions[];
	functionhooks?: string[];
	general?: ApiResponseQueryMetaSiteinfoGeneral;
	interwikimap?: ApiResponseQueryMetaSiteinfoInterwikimap[];
	languages?: ApiResponseQueryMetaSiteinfoLanguages[];
	languagevariants?: ApiResponseQueryMetaSiteinfoLanguagevariants;
	libraries?: ApiResponseQueryMetaSiteinfoLibraries[];
	magicwords?: ApiResponseQueryMetaSiteinfoMagicwords[];
	namespacealiases?: ApiResponseQueryMetaSiteinfoNamespacealiases[];
	namespaces?: ApiResponseQueryMetaSiteinfoNamespaces;
	normalized?: ApiResponseNormalized[];
	pageids?: string[];
	pages?: ApiResponseQueryPages[];
	protocols?: string[];
	/** `redirects=true` */
	redirects?: {
		from: string;
		to: string;
	}[];
	restrictions?: ApiResponseQueryMetaSiteinfoRestrictions;
	rightsinfo?: ApiResponseQueryMetaSiteinfoRightsinfo;
	showhooks?: ApiResponseQueryMetaSiteinfoShowhooks[];
	skins?: ApiResponseQueryMetaSiteinfoSkins[];
	specialpagealiases?: ApiResponseQueryMetaSiteinfoSpecialpagealiases[];
	statistics?: ApiResponseQueryMetaSiteinfoStatistics;
	uploaddialog?: ApiResponseQueryMetaSiteinfoUploaddialog;
	usergroups?: ApiResponseQueryMetaSiteinfoUsergroups[];
	variables?: string[];
	userinfo?: ApiResponseQueryMetaUserinfo;
	tokens?: ApiResponseQueryMetaTokens;
}

export interface ApiResponseQueryPages {
	// prop-independent properties
	pageid?: number;
	ns: number;
	title: string;
	invalidreason?: string;
	invalid?: boolean;
	missing?: boolean;
	// prop-dependent properties
	/** `prop=categories` */
	categories?: ApiResponseQueryPropCategories[];
	/** `prop=categoryinfo` */
	categoryinfo?: ApiResponseQueryPropCategoryinfo;
	/** `prop=cirrusbuilddoc` */
	cirrusbuilddoc?: ApiResponseQueryPropCirrusbuilddoc;
	/** `prop=cirrusbuilddoc` */
	cirrusbuilddoc_metadata?: ApiResponseQueryPropCirrusbuilddoc2;
	/** `prop=revisions` */
	revisions?: ApiResponseQueryPagesRevisions[];
	/** `prop=?` */
	protection?: ApiResponseQueryPagesProtection[];
}

export interface ApiResponseQueryPropCategories {
	ns: number;
	title: string;
	sortkey?: string;
	sortkeyprefix?: string;
	timestamp?: string;
	hidden?: boolean;
}
export interface ApiResponseQueryPropCategoryinfo {
	size: number;
	pages: number;
	files: number;
	subcats: number;
	hidden: boolean;
}

export interface ApiResponseQueryPropCirrusbuilddoc {
	version: number;
	wiki: string;
	page_id: number;
	namespace: number;
	namespace_text: string;
	title: string;
	timestamp: string;
	create_timestamp: string;
	redirect?: {
		namespace: number;
		title: string;
	}[];
	category?: string[];
	external_link?: string[];
	outgoing_link?: string[];
	template?: string[];
	text?: string;
	source_text?: string;
	text_bytes?: number;
	content_model?: string;
	/** [Needs update] */
	coordinates?: unknown[];
	wikibase_item?: string;
	language?: string;
	heading?: string[];
	opening_text?: string|null;
	auxiliary_text?: string[];
	defaultsort?: string|null;
	file_text?: string|null;
	display_title?: string|null;
}

export interface ApiResponseQueryPropCirrusbuilddoc2 {
	cluster_group: string;
	noop_hints: {
		version: string;
	};
	size_limiter_stats: {
		document: {
			original_length: number;
			new_length: number;
		};
	};
	index_name: string;
}

export interface ApiResponseQueryPagesRevisions { // Fully checked except for deprecated properties
	revid?: number;
	parentid?: number;
	minor?: boolean;
	user?: string;
	userid?: number;
	timestamp?: string;
	size?: number;
	sha1?: string;
	roles?: string[];
	slots?: {
		main: { // [slot: string]
			size?: number;
			sha1?: string;
			contentmodel?: string;
			contentformat?: string;
			content?: string;
			badcontentformat?: boolean;
		};
	};
	/** @deprecated Specify the `rvslots` parameter. */
	contentmodel?: string;
	/** @deprecated Use `action=expandtemplates` or `action=parse` instead. */
	parsetree?: string;
	/** @deprecated Specify the `rvslots` parameter. */
	contentformat?: string;
	/** @deprecated Specify the `rvslots` parameter. */
	content?: string;
	comment?: string;
	parsedcomment?: string;
	tags?: string[];
}

export interface ApiResponseQueryPagesProtection {
	type: string;
	level: string;
	expiry: string;
}

// ************************************ action=query&meta=allmessages ************************************

export interface ApiResponseQueryMetaAllmessages {
	name: string;
	normalizedname: string;
	content: string;
	missing?: boolean;
}

// ************************************ action=query&meta=siteinfo (complete) ************************************

export interface ApiResponseQueryMetaSiteinfoAutocreatetempuser {
	enabled: boolean;
}

export interface ApiResponseQueryMetaSiteinfoDbrepllag {
	host: string;
	lag: number;
}

export interface ApiResponseQueryMetaSiteinfoDefaultoptions {
	[option: string]: number|string|boolean|null;
}

export interface ApiResponseQueryMetaSiteinfoExtensions {
	type: string;
	name: string;
	descriptionmsg: string;
	author: string;
	url: string;
	'vcs-system': string;
	'vcs-version': string;
	'vcs-url': string;
	'vcs-date': string;
	'license-name': string;
	license: string;
}

export interface ApiResponseQueryMetaSiteinfoFileextensions {
	ext: string;
}

export interface ApiResponseQueryMetaSiteinfoGeneral {
	mainpage: string;
	base: string;
	sitename: string;
	mainpageisdomainroot: boolean;
	logo: string;
	generator: string;
	phpversion: string;
	phpsapi: string;
	dbtype: string;
	dbversion: string;
	imagewhitelistenabled: boolean;
	langconversion: boolean;
	linkconversion: boolean;
	titleconversion: boolean;
	linkprefixcharset: string;
	linkprefix: string;
	linktrail: string;
	legaltitlechars: string;
	invalidusernamechars: string;
	allunicodefixes: boolean;
	fixarabicunicode: boolean;
	fixmalayalamunicode: boolean;
	'git-hash': string;
	'git-branch': string;
	case: string;
	lang: string;
	fallback: {
		code: string;
	}[];
	rtl: boolean;
	fallback8bitEncoding: string;
	readonly: boolean;
	writeapi: boolean;
	maxarticlesize: number;
	timezone: string;
	timeoffset: number;
	articlepath: string;
	scriptpath: string;
	script: string;
	variantarticlepath: boolean;
	server: string;
	servername: string;
	wikiid: string;
	time: string;
	misermode: boolean;
	uploadsenabled: boolean;
	maxuploadsize: number;
	minuploadchunksize: number;
	galleryoptions: {
		imagesPerRow: number;
		imageWidth: number;
		imageHeight: number;
		captionLength: boolean;
		showBytes: boolean;
		mode: string;
		showDimensions: boolean;
	};
	thumblimits: Record<string, number>;
	imagelimits: Record<string, {
		width: number;
		height: number;
	}>;
	favicon: string;
	centralidlookupprovider: string;
	allcentralidlookupproviders: string[];
	interwikimagic: boolean;
	magiclinks: Record<string, boolean>;
	categorycollation: string;
	nofollowlinks: boolean;
	nofollownsexceptions: string[];
	nofollowdomainexceptions: string[];
	externallinktarget: boolean;
	'wmf-config': Record<string, any>;
	citeresponsivereferences: boolean;
	linter: {
		high: string[];
		medium: string[];
		low: string[];
		none: string[];
	};
	mobileserver: string;
	'pageviewservice-supported-metrics': {
		pageviews: {
			pageviews: boolean;
			uniques: boolean;
		};
		siteviews: {
			pageviews: boolean;
			uniques: boolean;
		};
		mostviewed: {
			pageviews: boolean;
			uniques: boolean;
		};
	};
	'readinglists-config': Record<string, any>;
}

export interface ApiResponseQueryMetaSiteinfoInterwikimap {
	prefix: string;
	local?: boolean;
	language?: string;
	deprecated?: string;
	bcp47?: string;
	url: string;
	protorel: boolean;
}

export interface ApiResponseQueryMetaSiteinfoLanguages {
	code: string;
	bcp47: string;
	name: string;
}

export interface ApiResponseQueryMetaSiteinfoLanguagevariants {
	[lang: string]: {
		[variant: string]: {
			fallbacks: string[];
		};
	};
}

export interface ApiResponseQueryMetaSiteinfoLibraries {
	name: string;
	version: string;
}

export interface ApiResponseQueryMetaSiteinfoMagicwords {
	name: string;
	aliases: string[];
	'case-sensitive': boolean;
}

export interface ApiResponseQueryMetaSiteinfoNamespacealiases {
	id: number;
	alias: string;
}

export interface ApiResponseQueryMetaSiteinfoNamespaces {
	[nsnumber: string]: {
		id: number;
		case: string;
		name: string;
		subpages: boolean;
		canonical?: string;
		content: boolean;
		nonincludable: boolean;
	}
}

export interface ApiResponseQueryMetaSiteinfoRestrictions {
	types: string[];
	levels: string[];
	cascadinglevels: string[];
	semiprotectedlevels: string[];
}

export interface ApiResponseQueryMetaSiteinfoRightsinfo {
	url: string;
	text: string;
}

export interface ApiResponseQueryMetaSiteinfoShowhooks {
	name: string;
	subscribers: string[];
}

export interface ApiResponseQueryMetaSiteinfoSkins {
	code: string;
	name: string;
	default?: boolean;
	unusable?: boolean;
}

export interface ApiResponseQueryMetaSiteinfoSpecialpagealiases {
	realname: string;
	aliases: string[];
}

export interface ApiResponseQueryMetaSiteinfoStatistics {
	pages: number;
	articles: number;
	edits: number;
	images: number;
	users: number;
	activeusers: number;
	admins: number;
	jobs: number;
	'cirrussearch-article-words': number;
	'queued-massmessages': number;
}

export interface ApiResponseQueryMetaSiteinfoUploaddialog {
	fields: {
		description: boolean;
		date: boolean;
		categories: boolean;
	};
	licensemessages: {
		local: string;
		foreign: string;
	};
	comment: {
		local: string;
		foreign: string;
	};
	format: {
		filepage: string;
		description: string;
		ownwork: string;
		license: string;
		uncategorized: string;
	};
}

export interface ApiResponseQueryMetaSiteinfoUsergroups {
	name: string;
	rights: string[];
	number?: number;
	add?: string[];
	remove?: string[];
	'remove-self'?: string[];
}

// ************************************ action=query&meta=userinfo (complete) ************************************

export interface ApiResponseQueryMetaUserinfo {
	id: number;
	name: string;
	anon?: boolean;
	messages?: boolean;
	groups?: string[];
	groupmemberships?: {
		group: string;
		expiry: string;
	}[];
	implicitgroups?: string[];
	rights?: string[];
	changeablegroups?: {
		add: string[];
		remove: string[];
		'add-self': string[];
		'remove-self': string[];
	},
	options?: {
		[key: string]: string|number|boolean|null;
	};
	editcount?: number;
	ratelimits?: {
		[key: string]: {
			[key: string]: {
				hits: number;
				seconds: number;
			};
		};
	};
	theoreticalratelimits?: {
		[key: string]: {
			[key: string]: {
				hits: number;
				seconds: number;
			};
		};
	};
	email?: string;
	emailauthenticated?: string;
	registrationdate?: string;
	acceptlang?: {
		q: number;
		code: string;
	}[];
	unreadcount?: string;
	centralids?: {
		CentralAuth: number;
		local: number;
	},
	attachedlocal?: {
		CentralAuth: boolean;
		local: boolean;
	},
	attachedwiki?: {
		CentralAuth: boolean;
		local: boolean;
	},
	latestcontrib?: string;
	cancreateaccount?: boolean;
}

// ************************************ action=query&meta=tokens (complete) ************************************

export interface ApiResponseQueryMetaTokens {
	createaccounttoken?: string;
	csrftoken?: string;
	deleteglobalaccounttoken?: string;
	logintoken?: string;
	patroltoken?: string;
	rollbacktoken?: string;
	setglobalaccountstatustoken?: string;
	userrightstoken?: string;
	watchtoken?: string;
}