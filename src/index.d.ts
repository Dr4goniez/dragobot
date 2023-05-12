export interface DynamicObject {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

// ******************* General API responses *******************
export interface ApiResponse {
    // General properties
    warnings?: {
        [key: string]: {
            warnings: string;
        };
    };
    batchcomplete?: boolean;
    requestid?: string;
    servedby?: string;
    curtimestamp?: string;
    uselang?: string;
    errorlang?: string;
    limits?: {
        [key: string]: number;
    };
    error?: ApiResponseError;
    continue?: {
        [key: string]: string;
    };
    normalized?: ApiResponseNormalized[];
    // Action-specific properties
    edit?: ApiResponseEdit;
    login?: ApiResponseLogin;
    purge?: ApiResponsePurge[];
    query?: ApiResponseQuery;
}
export interface ApiResponseError {
    code: string;
    info: string;
    docref: string;
}
export interface ApiResponseNormalized {
    fromencoded?: boolean;
    from: string;
    to: string;
}

// ******************* Actions (ApiResponse[Action]) *******************
// export interface ApiResponseAbusefiltercheckmatch {}
// export interface ApiResponseAbusefilterchecksyntax {}
// export interface ApiResponseAbusefilterevalexpression {}
// export interface ApiResponseAbusefilterunblockautopromote {}
// export interface ApiResponseAbuselogprivatedetails {}
// export interface ApiResponseAggregategroups {}
// export interface ApiResponseAntispoof {}
// export interface ApiResponseBlock {}
// export interface ApiResponseCentralauthtoken {}
// export interface ApiResponseCentralnoticecdncacheupdatebanner {}
// export interface ApiResponseCentralnoticechoicedata {}
// export interface ApiResponseCentralnoticequerycampaign {}
// export interface ApiResponseChangeauthenticationdata {}
// export interface ApiResponseChangecontentmodel {}
// export interface ApiResponseChecktoken {}
// export interface ApiResponseCirrus_config_dump {}
// export interface ApiResponseCirrus_mapping_dump {}
// export interface ApiResponseCirrus_profiles_dump {}
// export interface ApiResponseCirrus_settings_dump {}
// export interface ApiResponseClearhasmsg {}
// export interface ApiResponseClientlogin {}
// export interface ApiResponseCompare {}
// export interface ApiResponseCreateaccount {}
// export interface ApiResponseCreatelocalaccount {}
// export interface ApiResponseDelete {}
// export interface ApiResponseDeleteglobalaccount {}
// export interface ApiResponseEchomarkread {}
// export interface ApiResponseEchomarkseen {}
// export interface ApiResponseEchomute {}
export interface ApiResponseEdit {
    result: string;
    pageid: number;
    title: string;
    contentmodel: string;
    oldrevid: number;
    newrevid: number;
    newtimestamp: string;
}
// export interface ApiResponseEditmassmessagelist {}
// export interface ApiResponseEmailuser {}
// export interface ApiResponseExpandtemplates {}
// export interface ApiResponseFancycaptchareload {}
// export interface ApiResponseFeaturedfeed {}
// export interface ApiResponseFeedcontributions {}
// export interface ApiResponseFeedrecentchanges {}
// export interface ApiResponseFeedthreads {}
// export interface ApiResponseFeedwatchlist {}
// export interface ApiResponseFilerevert {}
// export interface ApiResponseFlow {}
// export interface ApiResponseFlow_parsoid_utils {}
// export interface ApiResponseFlowthank {}
// export interface ApiResponseGlobalblock {}
// export interface ApiResponseGlobalpreferenceoverrides {}
// export interface ApiResponseGlobalpreferences {}
// export interface ApiResponseGlobaluserrights {}
// export interface ApiResponseGraph {}
// export interface ApiResponseGroupreview {}
// export interface ApiResponseHelp {}
// export interface ApiResponseImagerotate {}
// export interface ApiResponseImport {}
// export interface ApiResponseJsonconfig {}
// export interface ApiResponseLanguagesearch {}
// export interface ApiResponseLinkaccount {}
export interface ApiResponseLogin {  
    lguserid?: number;
    result: string;
    lgusername: string;
    lgtoken?: string;
}
// export interface ApiResponseLogout {}
// export interface ApiResponseManagetags {}
// export interface ApiResponseMassmessage {}
// export interface ApiResponseMergehistory {}
// export interface ApiResponseMove {}
// export interface ApiResponseNewslettersubscribe {}
// export interface ApiResponseOpensearch {}
// export interface ApiResponseOptions {}
// export interface ApiResponseParaminfo {}
// export interface ApiResponseParse {}
// export interface ApiResponsePatrol {}
// export interface ApiResponseProtect {}
export interface ApiResponsePurge {
    ns: number;
    title: string;
    missing?: boolean;
    purged?: boolean;
}
// export interface ApiResponseQuery {} // Defined below
// export interface ApiResponseRemoveauthenticationdata {}
// export interface ApiResponseResetpassword {}
// export interface ApiResponseRevisiondelete {}
// export interface ApiResponseRollback {}
// export interface ApiResponseRsd {}
// export interface ApiResponseSearchtranslations {}
// export interface ApiResponseSetglobalaccountstatus {}
// export interface ApiResponseSetnotificationtimestamp {}
// export interface ApiResponseSetpagelanguage {}
// export interface ApiResponseShortenurl {}
// export interface ApiResponseSitematrix {}
// export interface ApiResponseSpamblacklist {}
// export interface ApiResponseStreamconfigs {}
// export interface ApiResponseStrikevote {}
// export interface ApiResponseTag {}
// export interface ApiResponseTemplatedata {}
// export interface ApiResponseThank {}
// export interface ApiResponseThreadaction {}
// export interface ApiResponseTitleblacklist {}
// export interface ApiResponseTorblock {}
// export interface ApiResponseTranscodereset {}
// export interface ApiResponseTranslationaids {}
// export interface ApiResponseTranslationreview {}
// export interface ApiResponseTranslationstats {}
// export interface ApiResponseTtmserver {}
// export interface ApiResponseUnblock {}
// export interface ApiResponseUndelete {}
// export interface ApiResponseUnlinkaccount {}
// export interface ApiResponseUpload {}
// export interface ApiResponseUserights {}
// export interface ApiResponseValidatepassword {}
// export interface ApiResponseWatch {}
// export interface ApiResponseWebapp_manifest {}
// export interface ApiResponseWebauthn {}
// export interface ApiResponseWikilove {}

// ******************* Action: Query *******************
export interface ApiResponseQuery {
    normalized?: ApiResponseNormalized[];
    pageids?: string[];
    badrevids?: {
        [key: string]: {
            revid: number;
            missing: boolean;
        };
    };
    pages?: ApiResponseQueryPages[];
    // abusefilters?: ApiResponseQueryListAbusefilters;
    // abuselog?: ApiResponseQueryListAbuselog;
    // allcategories?: ApiResponseQueryListAllcategories;
    // alldeletedrevisions?: ApiResponseQueryListAlldeletedrevisions;
    // allfileusages?: ApiResponseQueryListAllfileusages;
    // allimages?: ApiResponseQueryListAllimages;
    // alllinks?: ApiResponseQueryListAlllinks;
    // allpages?: ApiResponseQueryListAllpages;
    // allredirects?: ApiResponseQueryListAllredirects;
    // allrevisions?: ApiResponseQueryListAllrevisions;
    // alltransclusions?: ApiResponseQueryListAlltransclusions;
    // allusers?: ApiResponseQueryListAllusers;
    betafeatures?: ApiResponseQueryListBetafeatures;
    backlinks?: ApiResponseQueryListBacklinks[];
    blocks?: ApiResponseQueryListBlocks[];
    categorymembers?: ApiResponseQueryListCategorymembers[];
    // centralnoticeactivecampaigns?: ApiResponseQueryListCentralnoticeactivecampaigns;
    // centralnoticelogs?: ApiResponseQueryListCentralnoticelogs;
    // checkuser?: ApiResponseQueryListCheckuser;
    // checkuserlog?: ApiResponseQueryListCheckuserlog;
    embeddedin?: ApiResponseQueryListEmbeddedin[];
    // extdistrepos?: ApiResponseQueryListExtdistrepos;
    // exturlusage?: ApiResponseQueryListExturlusage;
    // filearchive?: ApiResponseQueryListFilearchive;
    // gadgetcategories?: ApiResponseQueryListGadgetcategories;
    // gadgets?: ApiResponseQueryListGadgets;
    globalallusers?: ApiResponseQueryListGlobalallusers[];
    globalblocks?: ApiResponseQueryListGlobalblocks[];
    // globalgroups?: ApiResponseQueryListGlobalgroups;
    // imageusage?: ApiResponseQueryListImageusage;
    // iwbacklinks?: ApiResponseQueryListIwbacklinks;
    // langbacklinks?: ApiResponseQueryListLangbacklinks;
    // linterrors?: ApiResponseQueryListLinterrors;
    logevents?: ApiResponseQueryListLogevents[];
    // messagecollection?: ApiResponseQueryListMessagecollection;
    // mostviewed?: ApiResponseQueryListMostviewed;
    // mystashedfiles?: ApiResponseQueryListMystashedfiles;
    // pagepropnames?: ApiResponseQueryListPagepropnames;
    // pageswithprop?: ApiResponseQueryListPageswithprop;
    // prefixsearch?: ApiResponseQueryListPrefixsearch;
    // protectedtitles?: ApiResponseQueryListProtectedtitles;
    // querypage?: ApiResponseQueryListQuerypage;
    // random?: ApiResponseQueryListRandom;
    // recentchanges?: ApiResponseQueryListRecentchanges;
    search?: ApiResponseQueryListSearch[];
    searchinfo?: {
        totalhits: number;
    };
    // tags?: ApiResponseQueryListTags;
    // threads?: ApiResponseQueryListThreads;
    usercontribs?: ApiResponseQueryListUsercontribs[];
    // users?: ApiResponseQueryListUsers;
    // watchlist?: ApiResponseQueryListWatchlist;
    // watchlistraw?: ApiResponseQueryListWatchlistraw;
    // wblistentityusage?: ApiResponseQueryListWblistentityusage;
    // wikisets?: ApiResponseQueryListWikisets;
}
export interface ApiResponseQueryPages {
    pageid?: number;
    ns: number;
    title: string;
    missing?: boolean;
    revisions?: ApiResponseQueryPagesRevisions[];
    contentmodel?: string;
    pagelanguage?: string;
    pagelanguagehtmlcode?: string;
    pagelanguagedir?: string;
    touched?: string;
    lastrevid?: number;
    length?: number;
    redirect?: boolean;
    protection?: ApiResponseQueryPagesProtection[];
    restrictiontypes?: string[];
    watched?: boolean;
    watchers?: number;
    visitingwatchers?: number;
    notificationtimestamp?: string;
    talkid?: number;
    associatedpage?: string;
    fullurl?: string;
    editurl?: string;
    canonicalurl?: string;
    readable?: boolean;
    preload?: string;
    displaytitle?: string;
    varianttitles?: {
        [key: string]: string;
    };
    linkclasses?: string[];
}
export interface ApiResponseQueryPagesRevisions {
    revid: number;
    parentid: number;
    minor: boolean;
    user: string;
    userid: number;
    timestamp: string;
    size: number;
    sha1: string;
    roles: string[];
    slots: {
        [key: string]: {
            size: number;
            sha1: string;
            contentmodel: string;
            contentformat: string;
            content: string;
        };
    };
    comment: string;
    parsedcomment: string;
    tags: string[];
}
export interface ApiResponseQueryPagesProtection {
    type: string;
    level: string;
    expiry: string;
}

// ******************* Action: Query => List *******************
// export interface ApiResponseQueryListAbusefilters {}
// export interface ApiResponseQueryListAbuselog {}
// export interface ApiResponseQueryListAllcategories {}
// export interface ApiResponseQueryListAlldeletedrevisions {}
// export interface ApiResponseQueryListAllfileusages {}
// export interface ApiResponseQueryListAllimages {}
// export interface ApiResponseQueryListAlllinks {}
// export interface ApiResponseQueryListAllpages {}
// export interface ApiResponseQueryListAllredirects {}
// export interface ApiResponseQueryListAllrevisions {}
// export interface ApiResponseQueryListAlltransclusions {}
// export interface ApiResponseQueryListAllusers {}
export interface ApiResponseQueryListBacklinks {
    pageid: number;
    ns: number;
    title: string;
}
export interface ApiResponseQueryListBetafeatures {
    [key: string]: {
        name: string;
        count: number;
    };
}
export interface ApiResponseQueryListBlocks {
    id: number;
    user: string;
    userid?: number;
    by: string;
    byid?: number;
    timestamp: string;
    expiry: string;
    reason: string;
    rangestart?: string;
    rangeend?: string;
    automatic: boolean;
    anononly: boolean;
    nocreate: boolean;
    autoblock: boolean;
    noemail: boolean;
    hidden: boolean;
    allowusertalk: boolean;
    partial: boolean;
    restrictions?: [] | {
        pages?: Array<{
            id: number;
            ns: number;
            title: string;
        }>;
        namespaces?: number[];
        actions?: string[];
    };
}
export interface ApiResponseQueryListCategorymembers {
    pageid: number;
    ns: number;
    title: string;
    sortkey?: string;
    sortkeyprefix?: string;
    type?: string;
    timestamp?: string;
}
// export interface ApiResponseQueryListCentralnoticeactivecampaigns {}
// export interface ApiResponseQueryListCentralnoticelogs {}
// export interface ApiResponseQueryListCheckuser {}
// export interface ApiResponseQueryListCheckuserlog {}
export interface ApiResponseQueryListEmbeddedin {
    pageid: number;
    ns: number;
    title: string;
}
// export interface ApiResponseQueryListExtdistrepos {}
// export interface ApiResponseQueryListExturlusage {}
// export interface ApiResponseQueryListFilearchive {}
// export interface ApiResponseQueryListGadgetcategories {}
// export interface ApiResponseQueryListGadgets {}
export interface ApiResponseQueryListGlobalallusers {
    id: number;
    name: string;
    /** Array of global user rights. Local rights are not included. */
    groups?: string[];
    /** Empty string if the account exists locally, otherwise the key is undefined. */
    existslocally?: "";
    /** Empty string if the account globally locked, otherwise the key is undefined. */
    locked?: "";
}
export interface ApiResponseQueryListGlobalblocks {
    id: string;
    address: string;
    /** Empty string if anononly is enabled, otherwise the key is undefined. */
    anononly?: "";
    by: string;
    bywiki: string;
    timestamp: string;
    expiry: string;
    reason: string;
    rangestart?: string;
    rangeend?: string;
}
// export interface ApiResponseQueryListGlobalgroups {}
// export interface ApiResponseQueryListImageusage {}
// export interface ApiResponseQueryListIwbacklinks {}
// export interface ApiResponseQueryListLangbacklinks {}
// export interface ApiResponseQueryListLinterrors {}
export interface ApiResponseQueryListLogevents {
    logid?: number;
    ns?: number;
    title?: string;
    pageid?: number;
    logpage?: number;
    params?: {
        userid?: number;
        curid?: number;
        previd?: number;
        auto?: boolean;
        description?: string;
        cascade?: boolean;
        details?: Array<{
            type: string;
            level: string;
            expiry: string;
            cascade: boolean;
        }>;
        target_ns?: number;
        target_title?: string;
        suppressredirect?: boolean;
        duration?: number|string;
        oldgroups?: string[];
        newgroups?: string[];
        flags?: string[];
        restrictions?: {
            pages?: Array<{
                page_ns: number;
                page_title: string;
            }>;
        };
        sitewide?: boolean;
        url?: string;
        expiry?: string;
        img_sha1?: string;
        img_timestamp?: string;
        oldtitle_ns?: number;
        oldtitle_title?: string;
        olduser?: string;
        newuser?: string;
        edits?: number;
        type?: string;
        ids?: number[];
        old?: {
            bitmask: number;
            content: false;
            comment: false;
            user: false;
            restricted: false
        };
        new?: {
            bitmask: number;
            content: false;
            comment: false;
            user: false;
            restricted: false
        };
        oldmetadata?: Array<{
            group: string;
            expiry: string
        }>;
        newmetadata?: Array<{
            group: string;
            expiry: string
        }>;
    };
    type?: string;
    action?: string;
    user?: string;
    userid?: number;
    timestamp?: string;
    comment?: string;
    parsedcomment?: string;
    tags?: string[];
}
// export interface ApiResponseQueryListMessagecollection {}
// export interface ApiResponseQueryListMostviewed {}
// export interface ApiResponseQueryListMystashedfiles {}
// export interface ApiResponseQueryListPagepropnames {}
// export interface ApiResponseQueryListPageswithprop {}
// export interface ApiResponseQueryListPrefixsearch {}
// export interface ApiResponseQueryListProtectedtitles {}
// export interface ApiResponseQueryListQuerypage {}
// export interface ApiResponseQueryListRandom {}
// export interface ApiResponseQueryListRecentchanges {}
export interface ApiResponseQueryListSearch {
    ns: number;
    title: string;
    pageid: number;
    size: number;
    wordcount: number;
    snippet: string;
    timestamp: string;
    titlesnippet?: string;
    categorysnippet?: string;
    isfilematch?: boolean;
}
// export interface ApiResponseQueryListTags {}
// export interface ApiResponseQueryListThreads {}
export interface ApiResponseQueryListUsercontribs {
    userid: number;
    user: string;
    pageid: number;
    revid: number;
    parentid: number;
    ns: number;
    title: string;
    timestamp: string;
    new: boolean;
    minor: boolean;
    top: boolean;
    comment: string;
    parsedcomment: string;
    patrolled: boolean;
    autopatrolled: boolean;
    size: number;
    sizediff: number;
    tags: string[];
}
// export interface ApiResponseQueryListUsers {}
// export interface ApiResponseQueryListWatchlist {}
// export interface ApiResponseQueryListWatchlistraw {}
// export interface ApiResponseQueryListWblistentityusage {}
// export interface ApiResponseQueryListWikisets {}


/**
 * API parameters
 * @license wikimedia-gadgets@github
 * @link https://github.com/wikimedia-gadgets/types-mediawiki/blob/main/api_params/index.d.ts
 * @edit MediaWiki Action API doesn't accept arrays to be passed as parameters.
 */
type dummy = string;

type timestamp = string;
type expiry = string;
type namespace = number;
type limit = number | "max";
type password = string;
type upload = File; // XXX

export interface ApiParams {
    action?: string;
    format?: "json" | "jsonfm" | "xml" | "xmlfm" | "php" | "none";
    maxlag?: number;
    smaxage?: number;
    maxage?: number;
    assert?: "user" | "bot" | "anon";
    assertuser?: string;
    requestid?: string;
    servedby?: boolean;
    curtimestamp?: boolean;
    responselanginfo?: boolean;
    origin?: string;
    uselang?: string;
    errorformat?: "bc" | "html" | "none" | "plaintext" | "raw" | "wikitext";
    errorlang?: string;
    errorsuselocal?: boolean;
    centralauthtoken?: string;

    // format=json
    callback?: string;
    utf8?: boolean;
    ascii?: boolean;
    formatversion?: "1" | "2" | "latest";
}

// AUTOMATICALLY GENERATED FROM HERE:

export interface AbuseFilterApiCheckMatchParams extends ApiParams {
    filter?: string;
    vars?: string;
    rcid?: number;
    logid?: number;
}

export interface AbuseFilterApiCheckSyntaxParams extends ApiParams {
    filter?: string;
}

export interface AbuseFilterApiEvalExpressionParams extends ApiParams {
    expression?: string;
    prettyprint?: boolean;
}

export interface AbuseFilterApiUnblockAutopromoteParams extends ApiParams {
    user?: string;
    token?: string;
}

export interface AbuseFilterApiAbuseLogPrivateDetailsParams extends ApiParams {
    logid?: number;
    reason?: string;
    token?: string;
}

export interface ApiParamsAntiSpoof extends ApiParams {
    username?: string;
}

export interface ApiParamsBlock extends ApiParams {
    user?: string;
    userid?: number;
    expiry?: string;
    reason?: string;
    anononly?: boolean;
    nocreate?: boolean;
    autoblock?: boolean;
    noemail?: boolean;
    hidename?: boolean;
    allowusertalk?: boolean;
    reblock?: boolean;
    watchuser?: boolean;
    watchlistexpiry?: expiry;
    tags?: string | string[];
    partial?: boolean;
    pagerestrictions?: string | string[];
    namespacerestrictions?: namespace | namespace[];
    token?: string;
}

export interface ApiParamsBounceHandler extends ApiParams {
    email?: string;
}

export interface ApiParamsCategoryTree extends ApiParams {
    category?: string;
    options?: string;
}

export interface ApiParamsCentralAuthToken extends ApiParams {}

export interface ApiParamsCentralNoticeCdnCacheUpdateBanner extends ApiParams {
    banner?: string;
    language?: string;
    token?: string;
}

export interface ApiParamsCentralNoticeChoiceData extends ApiParams {
    project?: string;
    language?: string;
}

export interface ApiParamsCentralNoticeQueryCampaign extends ApiParams {
    campaign?: string;
}

export interface ApiParamsChangeAuthenticationData extends ApiParams {
    request?: string;
    token?: string;
}

export interface ApiParamsChangeContentModel extends ApiParams {
    title?: string;
    pageid?: number;
    summary?: string;
    tags?: string | string[];
    model?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "wikitext";
    bot?: boolean;
    token?: string;
}

export interface ApiParamsCheckToken extends ApiParams {
    type?:
        | "createaccount"
        | "csrf"
        | "deleteglobalaccount"
        | "login"
        | "patrol"
        | "rollback"
        | "setglobalaccountstatus"
        | "userrights"
        | "watch";
    token?: string;
    maxtokenage?: number;
}

export interface CirrusSearchApiConfigDumpParams extends ApiParams {}

export interface CirrusSearchApiMappingDumpParams extends ApiParams {}

export interface CirrusSearchApiProfilesDumpParams extends ApiParams {
    verbose?: boolean;
}

export interface CirrusSearchApiSettingsDumpParams extends ApiParams {}

export interface ApiParamsClearHasMsg extends ApiParams {}

export interface ApiParamsClientLogin extends ApiParams {
    requests?: string | string[];
    messageformat?: "html" | "none" | "raw" | "wikitext";
    mergerequestfields?: boolean;
    preservestate?: boolean;
    returnurl?: string;
    continue?: boolean;
    token?: string;
}

export interface ApiParamsComparePages extends ApiParams {
    fromtitle?: string;
    fromid?: number;
    fromrev?: number;
    /** One or more of the following: "main" */
    fromslots?: string;
    frompst?: boolean;
    fromtext?: string;
    fromcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    fromcontentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    fromsection?: string;
    totitle?: string;
    toid?: number;
    torev?: number;
    torelative?: "cur" | "next" | "prev";
    /** One or more of the following: "main" */
    toslots?: string;
    topst?: boolean;
    totext?: string;
    tocontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    tocontentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    tosection?: string;
    /** One or more of the following: "comment" | "diff" | "diffsize" | "ids" | "parsedcomment" | "rel" | "size" | "timestamp" | "title" | "user" */
    prop?: string;
    /** One or more of the following: "main" */
    slots?: string;
}

export interface ApiParamsAMCreateAccount extends ApiParams {
    requests?: string | string[];
    messageformat?: "html" | "none" | "raw" | "wikitext";
    mergerequestfields?: boolean;
    preservestate?: boolean;
    returnurl?: string;
    continue?: boolean;
    token?: string;
}

export interface ApiParamsCreateLocalAccount extends ApiParams {
    username?: string;
    reason?: string;
    token?: string;
}

export interface ApiParamsCSPReport extends ApiParams {
    reportonly?: boolean;
    source?: string;
}

export interface ApiParamsContentTranslationConfiguration extends ApiParams {
    from?: string;
    to?: string;
}

export interface ApiParamsContentTranslationDelete extends ApiParams {
    from?: string;
    to?: string;
    sourcetitle?: string;
    token?: string;
}

export interface ApiParamsContentTranslationPublish extends ApiParams {
    title?: string;
    html?: string;
    from?: string;
    to?: string;
    sourcetitle?: string;
    categories?: string;
    publishtags?: string | string[];
    wpCaptchaId?: string;
    wpCaptchaWord?: string;
    cxversion?: number;
    token?: string;
}

export interface ContentTranslationActionApiSectionTranslationPublishParams extends ApiParams {
    title?: string;
    html?: string;
    sourcelanguage?: string;
    targetlanguage?: string;
    sourcetitle?: string;
    sourcerevid?: string;
    sourcesectiontitle?: string;
    targetsectiontitle?: string;
    sectionnumber?: string;
    captchaid?: string;
    captchaword?: string;
    token?: string;
}

export interface ApiParamsContentTranslationSave extends ApiParams {
    from?: string;
    to?: string;
    sourcetitle?: string;
    title?: string;
    content?: string;
    sourcerevision?: number;
    progress?: string;
    cxversion?: number;
    sourcecategories?: string;
    targetcategories?: string;
    token?: string;
}

export interface ApiParamsContentTranslationSuggestionList extends ApiParams {
    listname?: string;
    listaction?: "add" | "remove" | "view";
    titles?: string | string[];
    from?: string;
    to?: string;
    token?: string;
}

export interface ApiParamsContentTranslationToken extends ApiParams {
    token?: string;
}

export interface ApiParamsDelete extends ApiParams {
    title?: string;
    pageid?: number;
    reason?: string;
    tags?: string | string[];
    watch?: boolean;
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    watchlistexpiry?: expiry;
    unwatch?: boolean;
    oldimage?: string;
    token?: string;
}

export interface ApiParamsDeleteGlobalAccount extends ApiParams {
    user?: string;
    reason?: string;
    token?: string;
}

export interface DiscussionToolsApiDiscussionToolsParams extends ApiParams {
    paction?: "transcludedfrom";
    page?: string;
    oldid?: string;
}

export interface DiscussionToolsApiDiscussionToolsEditParams extends ApiParams {
    paction?: "addcomment" | "addtopic";
    page?: string;
    token?: string;
    commentid?: string;
    wikitext?: string;
    html?: string;
    summary?: string;
    sectiontitle?: string;
    watchlist?: string;
    captchaid?: string;
    captchaword?: string;
}

export interface ApiParamsEchoMarkRead extends ApiParams {
    wikis?: string | string[];
    list?: string | string[];
    unreadlist?: string | string[];
    all?: boolean;
    /** One or more of the following: "alert" | "message" */
    sections?: string;
    token?: string;
}

export interface ApiParamsEchoMarkSeen extends ApiParams {
    type?: "alert" | "all" | "message";
    timestampFormat?: "ISO_8601" | "MW";
}

export interface ApiParamsEchoMute extends ApiParams {
    type?: "page-linked-title" | "user";
    mute?: string | string[];
    unmute?: string | string[];
    token?: string;
}

export interface EchoPushApiEchoPushSubscriptionsParams extends ApiParams {
    command?: "create" | "delete";
    token?: string;
}

export interface ApiParamsEditPage extends ApiParams {
    title?: string;
    pageid?: number;
    section?: string;
    sectiontitle?: string;
    text?: string;
    summary?: string;
    tags?: string | string[];
    minor?: boolean;
    notminor?: boolean;
    bot?: boolean;
    baserevid?: number;
    basetimestamp?: timestamp;
    starttimestamp?: timestamp;
    recreate?: boolean;
    createonly?: boolean;
    nocreate?: boolean;
    watch?: boolean;
    unwatch?: boolean;
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    watchlistexpiry?: expiry;
    md5?: string;
    prependtext?: string;
    appendtext?: string;
    undo?: number;
    undoafter?: number;
    redirect?: boolean;
    contentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    contentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    token?: string;
    captchaword?: string;
    captchaid?: string;
}

export interface MediaWikiMassMessageApiEditMassMessageListParams extends ApiParams {
    spamlist?: string;
    description?: string;
    add?: string | string[];
    remove?: string | string[];
    token?: string;
}

export interface ApiParamsEmailUser extends ApiParams {
    target?: string;
    subject?: string;
    text?: string;
    ccme?: boolean;
    token?: string;
}

export interface ApiParamsExpandTemplates extends ApiParams {
    title?: string;
    text?: string;
    revid?: number;
    /** One or more of the following: "categories" | "encodedjsconfigvars" | "jsconfigvars" | "modules" | "parsetree" | "properties" | "ttl" | "volatile" | "wikitext" */
    prop?: string;
    includecomments?: boolean;
    generatexml?: boolean;
    templatesandboxprefix?: string | string[];
    templatesandboxtitle?: string;
    templatesandboxtext?: string;
    templatesandboxcontentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    templatesandboxcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
}

export interface ApiParamsFancyCaptchaReload extends ApiParams {}

export interface ApiParamsFeaturedFeeds extends ApiParams {
    feedformat?: "atom" | "rss";
    feed?: "featured" | "onthisday" | "potd";
    language?: string;
}

export interface ApiParamsFeedContributions extends ApiParams {
    feedformat?: "atom" | "rss";
    user?: string;
    namespace?: namespace;
    year?: number;
    month?: number;
    tagfilter?: string | string[];
    deletedonly?: boolean;
    toponly?: boolean;
    newonly?: boolean;
    hideminor?: boolean;
    showsizediff?: boolean;
}

export interface ApiParamsFeedRecentChanges extends ApiParams {
    feedformat?: "atom" | "rss";
    namespace?: namespace;
    invert?: boolean;
    associated?: boolean;
    days?: number;
    limit?: number;
    from?: timestamp;
    hideminor?: boolean;
    hidebots?: boolean;
    hideanons?: boolean;
    hideliu?: boolean;
    hidepatrolled?: boolean;
    hidemyself?: boolean;
    hidecategorization?: boolean;
    tagfilter?: string | string[];
    target?: string;
    showlinkedto?: boolean;
}

export interface ApiParamsFeedWatchlist extends ApiParams {
    feedformat?: "atom" | "rss";
    hours?: number;
    linktosections?: boolean;
    allrev?: boolean;
    wlowner?: string;
    wltoken?: string;
    /** One or more of the following: "!anon" | "!autopatrolled" | "!bot" | "!minor" | "!patrolled" | "!unread" | "anon" | "autopatrolled" | "bot" | "minor" | "patrolled" | "unread" */
    wlshow?: string;
    /** One or more of the following: "categorize" | "edit" | "external" | "log" | "new" */
    wltype?: string;
    wlexcludeuser?: string;
}

export interface ApiParamsFileRevert extends ApiParams {
    filename?: string;
    comment?: string;
    archivename?: string;
    token?: string;
}

export interface ApiParamsFlagConfig extends ApiParams {}

export interface ApiParamsGlobalBlock extends ApiParams {
    target?: string;
    expiry?: string;
    unblock?: boolean;
    reason?: string;
    anononly?: boolean;
    modify?: boolean;
    alsolocal?: boolean;
    localblockstalk?: boolean;
    token?: string;
}

export interface GlobalPreferencesApiGlobalPreferenceOverridesParams extends ApiParams {
    reset?: boolean;
    /** One or more of the following: "all" | "registered" | "registered-checkmatrix" | "registered-multiselect" | "special" | "unused" | "userjs" */
    resetkinds?: string;
    change?: string | string[];
    optionname?: string;
    optionvalue?: string;
    token?: string;
}

export interface GlobalPreferencesApiGlobalPreferencesParams extends ApiParams {
    reset?: boolean;
    /** One or more of the following: "all" | "registered" | "registered-checkmatrix" | "registered-multiselect" | "special" | "unused" | "userjs" */
    resetkinds?: string;
    change?: string | string[];
    optionname?: string;
    optionvalue?: string;
    token?: string;
}

export interface ApiParamsGlobalUserRights extends ApiParams {
    user?: string;
    userid?: number;
    /** One or more of the following: "abusefilter-helper" | "abusefilter-maintainer" | "apihighlimits-requestor" | "captcha-exempt" | "founder" | "global-bot" | "global-deleter" | "global-flow-create" | "global-interface-editor" | "global-ipblock-exempt" | "global-rollbacker" | "global-sysop" | "new-wikis-importer" | "oathauth-tester" | "ombuds" | "otrs-member" | "recursive-export" | "staff" | "steward" | "sysadmin" | "wmf-ops-monitoring" | "wmf-researcher" */
    add?: string;
    /** One or more of the following: "abusefilter-helper" | "abusefilter-maintainer" | "apihighlimits-requestor" | "captcha-exempt" | "founder" | "global-bot" | "global-deleter" | "global-flow-create" | "global-interface-editor" | "global-ipblock-exempt" | "global-rollbacker" | "global-sysop" | "new-wikis-importer" | "oathauth-tester" | "ombuds" | "otrs-member" | "recursive-export" | "staff" | "steward" | "sysadmin" | "wmf-ops-monitoring" | "wmf-researcher" */
    remove?: string;
    reason?: string;
    token?: string;
    tags?: string | string[];
}

export interface GraphApiGraphParams extends ApiParams {
    hash?: string;
    title?: string;
    text?: string;
    oldid?: number;
}

export interface ApiParamsHelp extends ApiParams {
    modules?: string | string[];
    submodules?: boolean;
    recursivesubmodules?: boolean;
    wrap?: boolean;
    toc?: boolean;
}

export interface ApiParamsDisabled extends ApiParams {}

export interface ApiParamsImport extends ApiParams {
    summary?: string;
    xml?: upload;
    interwikiprefix?: string;
    interwikisource?:
        | "commons"
        | "de"
        | "es"
        | "fr"
        | "it"
        | "meta"
        | "nost"
        | "outreachwiki"
        | "pl"
        | "test2wiki";
    interwikipage?: string;
    fullhistory?: boolean;
    templates?: boolean;
    namespace?: namespace;
    assignknownusers?: boolean;
    rootpage?: string;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsFormatJson extends ApiParams {
    callback?: string;
    utf8?: boolean;
    ascii?: boolean;
    formatversion?: "1" | "2" | "latest";
}

export interface JsonConfigJCApiParams extends ApiParams {
    command?: "reload" | "reset" | "status";
    namespace?: number;
    title?: string;
    content?: string;
}

export interface JsonConfigJCDataApiParams extends ApiParams {
    title?: string;
}

export interface ApiParamsFormatJson extends ApiParams {
    wrappedhtml?: boolean;
    callback?: string;
    utf8?: boolean;
    ascii?: boolean;
    formatversion?: "1" | "2" | "latest";
}

export interface ApiParamsLanguageSearch extends ApiParams {
    search?: string;
    typos?: number;
}

export interface ApiParamsLinkAccount extends ApiParams {
    requests?: string | string[];
    messageformat?: "html" | "none" | "raw" | "wikitext";
    mergerequestfields?: boolean;
    returnurl?: string;
    continue?: boolean;
    token?: string;
}

export interface ApiParamsLogin extends ApiParams {
    name?: string;
    password?: password;
    domain?: string;
    token?: string;
}

export interface ApiParamsLogout extends ApiParams {
    token?: string;
}

export interface ApiParamsManageTags extends ApiParams {
    operation?: "activate" | "create" | "deactivate" | "delete";
    tag?: string;
    reason?: string;
    ignorewarnings?: boolean;
    tags?: string | string[];
    token?: string;
}

export interface MediaWikiMassMessageApiMassMessageParams extends ApiParams {
    "spamlist"?: string;
    "subject"?: string;
    "message"?: string;
    "page-message"?: string;
    "token"?: string;
}

export interface ApiParamsMergeHistory extends ApiParams {
    from?: string;
    fromid?: number;
    to?: string;
    toid?: number;
    timestamp?: timestamp;
    reason?: string;
    token?: string;
}

export interface MobileFrontendApiMobileViewParams extends ApiParams {
    page?: string;
    redirect?: "no" | "yes";
    sections?: string;
    /** One or more of the following: "contentmodel" | "description" | "displaytitle" | "editable" | "hasvariants" | "id" | "image" | "languagecount" | "lastmodified" | "lastmodifiedby" | "namespace" | "normalizedtitle" | "pageprops" | "protection" | "revision" | "sections" | "text" | "thumb" */
    prop?: string;
    /** One or more of the following: "anchor" | "fromtitle" | "index" | "level" | "line" | "number" | "toclevel" */
    sectionprop?: string;
    pageprops?: string;
    variant?: string;
    noheadings?: boolean;
    notransform?: boolean;
    onlyrequestedsections?: boolean;
    offset?: number;
    maxlen?: number;
    revision?: number;
    thumbheight?: number;
    thumbwidth?: number;
    thumbsize?: number;
}

export interface ApiParamsMove extends ApiParams {
    from?: string;
    fromid?: number;
    to?: string;
    reason?: string;
    movetalk?: boolean;
    movesubpages?: boolean;
    noredirect?: boolean;
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    watchlistexpiry?: expiry;
    ignorewarnings?: boolean;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsFormatNone extends ApiParams {}

export interface OATHAuthApiModuleApiOATHValidateParams extends ApiParams {
    user?: string;
    totp?: string;
    data?: string;
    token?: string;
}

export interface ApiParamsOpenSearch extends ApiParams {
    search?: string;
    namespace?: namespace | namespace[];
    limit?: limit;
    profile?: "classic" | "engine_autoselect" | "fast-fuzzy" | "fuzzy" | "normal" | "strict";
    suggest?: boolean;
    redirects?: "resolve" | "return";
    format?: "json" | "jsonfm" | "xml" | "xmlfm";
    warningsaserror?: boolean;
}

export interface ApiParamsOptions extends ApiParams {
    reset?: boolean;
    /** One or more of the following: "all" | "registered" | "registered-checkmatrix" | "registered-multiselect" | "special" | "unused" | "userjs" */
    resetkinds?: string;
    change?: string | string[];
    optionname?: string;
    optionvalue?: string;
    token?: string;
}

export interface PageTriageApiPageTriageActionParams extends ApiParams {
    pageid?: number;
    reviewed?: "0" | "1";
    enqueue?: boolean;
    token?: string;
    note?: string;
    skipnotif?: boolean;
}

export interface PageTriageApiPageTriageListParams extends ApiParams {
    show_predicted_class_stub?: boolean;
    show_predicted_class_start?: boolean;
    show_predicted_class_c?: boolean;
    show_predicted_class_b?: boolean;
    show_predicted_class_good?: boolean;
    show_predicted_class_featured?: boolean;
    show_predicted_issues_vandalism?: boolean;
    show_predicted_issues_spam?: boolean;
    show_predicted_issues_attack?: boolean;
    show_predicted_issues_none?: boolean;
    show_predicted_issues_copyvio?: boolean;
    showbots?: boolean;
    showredirs?: boolean;
    showothers?: boolean;
    showreviewed?: boolean;
    showunreviewed?: boolean;
    showdeleted?: boolean;
    namespace?: number;
    afc_state?: number;
    no_category?: boolean;
    unreferenced?: boolean;
    no_inbound_links?: boolean;
    recreated?: boolean;
    non_autoconfirmed_users?: boolean;
    learners?: boolean;
    blocked_users?: boolean;
    username?: string;
    date_range_from?: timestamp;
    date_range_to?: timestamp;
    page_id?: number;
    limit?: number;
    offset?: number;
    pageoffset?: number;
    dir?: "newestfirst" | "newestreview" | "oldestfirst" | "oldestreview";
}

export interface PageTriageApiPageTriageStatsParams extends ApiParams {
    show_predicted_class_stub?: boolean;
    show_predicted_class_start?: boolean;
    show_predicted_class_c?: boolean;
    show_predicted_class_b?: boolean;
    show_predicted_class_good?: boolean;
    show_predicted_class_featured?: boolean;
    show_predicted_issues_vandalism?: boolean;
    show_predicted_issues_spam?: boolean;
    show_predicted_issues_attack?: boolean;
    show_predicted_issues_none?: boolean;
    show_predicted_issues_copyvio?: boolean;
    showbots?: boolean;
    showredirs?: boolean;
    showothers?: boolean;
    showreviewed?: boolean;
    showunreviewed?: boolean;
    showdeleted?: boolean;
    namespace?: number;
    afc_state?: number;
    no_category?: boolean;
    unreferenced?: boolean;
    no_inbound_links?: boolean;
    recreated?: boolean;
    non_autoconfirmed_users?: boolean;
    learners?: boolean;
    blocked_users?: boolean;
    username?: string;
    date_range_from?: timestamp;
    date_range_to?: timestamp;
    topreviewers?: string;
}

export interface PageTriageApiPageTriageTagCopyvioParams extends ApiParams {
    revid?: number;
    token?: string;
}

export interface PageTriageApiPageTriageTaggingParams extends ApiParams {
    pageid?: number;
    token?: string;
    top?: string;
    bottom?: string;
    deletion?: boolean;
    note?: string;
    taglist?: string | string[];
}

export interface ApiParamsParamInfo extends ApiParams {
    modules?: string | string[];
    helpformat?: "html" | "none" | "raw" | "wikitext";
    /** One or more of the following: "abusefilters" | "abuselog" | "allcategories" | "alldeletedrevisions" | "allfileusages" | "allimages" | "alllinks" | "allmessages" | "allpages" | "allredirects" | "allrevisions" | "alltransclusions" | "allusers" | "authmanagerinfo" | "babel" | "backlinks" | "betafeatures" | "blocks" | "categories" | "categoryinfo" | "categorymembers" | "centralnoticeactivecampaigns" | "centralnoticelogs" | "checkuser" | "checkuserlog" | "cirrusbuilddoc" | "cirruscompsuggestbuilddoc" | "cirrusdoc" | "contenttranslation" | "contenttranslationcorpora" | "contenttranslationlangtrend" | "contenttranslationstats" | "contenttranslationsuggestions" | "contributors" | "coordinates" | "cxdeletedtranslations" | "cxpublishedtranslations" | "cxtranslatorstats" | "deletedrevisions" | "deletedrevs" | "description" | "duplicatefiles" | "embeddedin" | "extlinks" | "extracts" | "exturlusage" | "featureusage" | "filearchive" | "filerepoinfo" | "fileusage" | "flagged" | "gadgetcategories" | "gadgets" | "geosearch" | "gettingstartedgetpages" | "globalallusers" | "globalblocks" | "globalgroups" | "globalpreferences" | "globalrenamestatus" | "globalusage" | "globaluserinfo" | "imageinfo" | "images" | "imageusage" | "info" | "iwbacklinks" | "iwlinks" | "langbacklinks" | "langlinks" | "langlinkscount" | "languageinfo" | "links" | "linkshere" | "linterrors" | "linterstats" | "logevents" | "mapdata" | "mmsites" | "mostviewed" | "mystashedfiles" | "notifications" | "oath" | "oldreviewedpages" | "ores" | "pageassessments" | "pageimages" | "pagepropnames" | "pageprops" | "pageswithprop" | "pageterms" | "pageviews" | "prefixsearch" | "projectpages" | "projects" | "protectedtitles" | "querypage" | "random" | "readinglistentries" | "readinglists" | "recentchanges" | "redirects" | "revisions" | "search" | "siteinfo" | "siteviews" | "stashimageinfo" | "tags" | "templates" | "tokens" | "transcludedin" | "transcodestatus" | "unreadnotificationpages" | "usercontribs" | "userinfo" | "users" | "videoinfo" | "watchlist" | "watchlistraw" | "wbentityusage" | "wblistentityusage" | "wikibase" | "wikisets" */
    querymodules?: string;
    mainmodule?: string;
    pagesetmodule?: string;
    /** One or more of the following: "json" | "jsonfm" | "none" | "php" | "phpfm" | "rawfm" | "xml" | "xmlfm" */
    formatmodules?: string;
}

export interface ApiParamsParse extends ApiParams {
    title?: string;
    text?: string;
    revid?: number;
    summary?: string;
    page?: string;
    pageid?: number;
    redirects?: boolean;
    oldid?: number;
    /** One or more of the following: "categories" | "categorieshtml" | "displaytitle" | "encodedjsconfigvars" | "externallinks" | "headhtml" | "images" | "indicators" | "iwlinks" | "jsconfigvars" | "langlinks" | "limitreportdata" | "limitreporthtml" | "links" | "modules" | "parsetree" | "parsewarnings" | "parsewarningshtml" | "properties" | "revid" | "sections" | "subtitle" | "templates" | "text" | "wikitext" | "headitems" */
    prop?: string;
    wrapoutputclass?: string;
    pst?: boolean;
    onlypst?: boolean;
    effectivelanglinks?: boolean;
    section?: string;
    sectiontitle?: string;
    disablepp?: boolean;
    disablelimitreport?: boolean;
    disableeditsection?: boolean;
    disablestylededuplication?: boolean;
    generatexml?: boolean;
    preview?: boolean;
    sectionpreview?: boolean;
    disabletoc?: boolean;
    useskin?: "minerva" | "modern" | "monobook" | "timeless" | "vector";
    contentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    contentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    mobileformat?: boolean;
    mainpage?: boolean;
    templatesandboxprefix?: string | string[];
    templatesandboxtitle?: string;
    templatesandboxtext?: string;
    templatesandboxcontentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    templatesandboxcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
}

export interface ApiParamsPatrol extends ApiParams {
    rcid?: number;
    revid?: number;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsFormatPhp extends ApiParams {
    formatversion?: "1" | "2" | "latest";
}

export interface ApiParamsFormatPhp extends ApiParams {
    wrappedhtml?: boolean;
    formatversion?: "1" | "2" | "latest";
}

export interface ApiParamsProtect extends ApiParams {
    title?: string;
    pageid?: number;
    protections?: string | string[];
    expiry?: string | string[];
    reason?: string;
    tags?: string | string[];
    cascade?: boolean;
    watch?: boolean;
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    watchlistexpiry?: expiry;
    token?: string;
}

export interface ApiParamsPurge extends ApiParams {
    forcelinkupdate?: boolean;
    forcerecursivelinkupdate?: boolean;
    continue?: string;
    titles?: string | string[];
    pageids?: number | number[];
    revids?: number | number[];
    generator?:
        | "allcategories"
        | "alldeletedrevisions"
        | "allfileusages"
        | "allimages"
        | "alllinks"
        | "allpages"
        | "allredirects"
        | "allrevisions"
        | "alltransclusions"
        | "backlinks"
        | "categories"
        | "categorymembers"
        | "contenttranslation"
        | "contenttranslationsuggestions"
        | "deletedrevisions"
        | "duplicatefiles"
        | "embeddedin"
        | "exturlusage"
        | "fileusage"
        | "geosearch"
        | "gettingstartedgetpages"
        | "images"
        | "imageusage"
        | "iwbacklinks"
        | "langbacklinks"
        | "links"
        | "linkshere"
        | "mostviewed"
        | "oldreviewedpages"
        | "pageswithprop"
        | "prefixsearch"
        | "projectpages"
        | "protectedtitles"
        | "querypage"
        | "random"
        | "recentchanges"
        | "redirects"
        | "revisions"
        | "search"
        | "templates"
        | "transcludedin"
        | "watchlist"
        | "watchlistraw"
        | "wblistentityusage"
        | "readinglistentries";
    redirects?: boolean;
    converttitles?: boolean;
}

export interface ApiParamsQuery extends ApiParams {
    /** One or more of the following: "categories" | "categoryinfo" | "cirrusbuilddoc" | "cirruscompsuggestbuilddoc" | "cirrusdoc" | "contributors" | "coordinates" | "deletedrevisions" | "duplicatefiles" | "extlinks" | "extracts" | "fileusage" | "flagged" | "globalusage" | "imageinfo" | "images" | "info" | "iwlinks" | "langlinks" | "langlinkscount" | "links" | "linkshere" | "pageassessments" | "pageimages" | "pageprops" | "pageterms" | "pageviews" | "redirects" | "revisions" | "stashimageinfo" | "templates" | "transcludedin" | "transcodestatus" | "videoinfo" | "wbentityusage" | "description" | "mapdata" */
    prop?: string;
    /** One or more of the following: "abusefilters" | "abuselog" | "allcategories" | "alldeletedrevisions" | "allfileusages" | "allimages" | "alllinks" | "allpages" | "allredirects" | "allrevisions" | "alltransclusions" | "allusers" | "backlinks" | "betafeatures" | "blocks" | "categorymembers" | "centralnoticeactivecampaigns" | "centralnoticelogs" | "checkuser" | "checkuserlog" | "contenttranslation" | "contenttranslationcorpora" | "contenttranslationlangtrend" | "contenttranslationstats" | "contenttranslationsuggestions" | "cxpublishedtranslations" | "cxtranslatorstats" | "embeddedin" | "exturlusage" | "filearchive" | "gadgetcategories" | "gadgets" | "geosearch" | "gettingstartedgetpages" | "globalallusers" | "globalblocks" | "globalgroups" | "imageusage" | "iwbacklinks" | "langbacklinks" | "linterrors" | "logevents" | "mostviewed" | "mystashedfiles" | "oldreviewedpages" | "pagepropnames" | "pageswithprop" | "prefixsearch" | "projectpages" | "projects" | "protectedtitles" | "querypage" | "random" | "recentchanges" | "search" | "tags" | "usercontribs" | "users" | "watchlist" | "watchlistraw" | "wblistentityusage" | "wikisets" | "deletedrevs" | "mmsites" | "readinglistentries" */
    list?: string;
    /** One or more of the following: "allmessages" | "authmanagerinfo" | "babel" | "featureusage" | "filerepoinfo" | "globalpreferences" | "globalrenamestatus" | "globaluserinfo" | "languageinfo" | "linterstats" | "notifications" | "ores" | "siteinfo" | "siteviews" | "tokens" | "unreadnotificationpages" | "userinfo" | "wikibase" | "cxdeletedtranslations" | "oath" | "readinglists" */
    meta?: string;
    indexpageids?: boolean;
    export?: boolean;
    exportnowrap?: boolean;
    exportschema?: "0.10" | "0.11";
    iwurl?: boolean;
    continue?: string;
    rawcontinue?: boolean;
    titles?: string | string[];
    pageids?: number | number[];
    revids?: number | number[];
    generator?:
        | "allcategories"
        | "alldeletedrevisions"
        | "allfileusages"
        | "allimages"
        | "alllinks"
        | "allpages"
        | "allredirects"
        | "allrevisions"
        | "alltransclusions"
        | "backlinks"
        | "categories"
        | "categorymembers"
        | "contenttranslation"
        | "contenttranslationsuggestions"
        | "deletedrevisions"
        | "duplicatefiles"
        | "embeddedin"
        | "exturlusage"
        | "fileusage"
        | "geosearch"
        | "gettingstartedgetpages"
        | "images"
        | "imageusage"
        | "iwbacklinks"
        | "langbacklinks"
        | "links"
        | "linkshere"
        | "mostviewed"
        | "oldreviewedpages"
        | "pageswithprop"
        | "prefixsearch"
        | "projectpages"
        | "protectedtitles"
        | "querypage"
        | "random"
        | "recentchanges"
        | "redirects"
        | "revisions"
        | "search"
        | "templates"
        | "transcludedin"
        | "watchlist"
        | "watchlistraw"
        | "wblistentityusage"
        | "readinglistentries";
    redirects?: boolean;
    converttitles?: boolean;
}

export interface ApiParamsFormatJson extends ApiParams {
    wrappedhtml?: boolean;
}

export interface ReadingListsApiReadingListsParams extends ApiParams {
    command?: "create" | "createentry" | "delete" | "deleteentry" | "setup" | "teardown" | "update";
    token?: string;
}

export interface MediaWikiLinterApiRecordLintParams extends ApiParams {
    data?: string;
    page?: string;
    revision?: number;
}

export interface ApiParamsRemoveAuthenticationData extends ApiParams {
    request?: string;
    token?: string;
}

export interface ApiParamsResetPassword extends ApiParams {
    user?: string;
    email?: string;
    token?: string;
}

export interface ApiParamsReview extends ApiParams {
    revid?: string;
    comment?: string;
    unapprove?: boolean;
    token?: string;
}

export interface ApiParamsReviewActivity extends ApiParams {
    previd?: string;
    oldid?: string;
    reviewing?: "0" | "1";
    token?: string;
}

export interface ApiParamsRevisionDelete extends ApiParams {
    type?: "archive" | "filearchive" | "logging" | "oldimage" | "revision";
    target?: string;
    ids?: string | string[];
    /** One or more of the following: "comment" | "content" | "user" */
    hide?: string;
    /** One or more of the following: "comment" | "content" | "user" */
    show?: string;
    suppress?: "no" | "nochange" | "yes";
    reason?: string;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsRollback extends ApiParams {
    title?: string;
    pageid?: number;
    tags?: string | string[];
    user?: string;
    summary?: string;
    markbot?: boolean;
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    watchlistexpiry?: expiry;
    token?: string;
}

export interface ApiParamsRsd extends ApiParams {}

export interface KartographerApiSanitizeMapDataParams extends ApiParams {
    title?: string;
    text?: string;
}

export interface ApiParamsScribuntoConsole extends ApiParams {
    title?: string;
    content?: string;
    session?: number;
    question?: string;
    clear?: boolean;
}

export interface ApiParamsSetGlobalAccountStatus extends ApiParams {
    user?: string;
    locked?: "" | "lock" | "unlock";
    hidden?: "" | "lists" | "suppressed";
    reason?: string;
    statecheck?: string;
    token?: string;
}

export interface ApiParamsSetNotificationTimestamp extends ApiParams {
    entirewatchlist?: boolean;
    timestamp?: timestamp;
    torevid?: number;
    newerthanrevid?: number;
    continue?: string;
    titles?: string | string[];
    pageids?: number | number[];
    revids?: number | number[];
    generator?:
        | "allcategories"
        | "alldeletedrevisions"
        | "allfileusages"
        | "allimages"
        | "alllinks"
        | "allpages"
        | "allredirects"
        | "allrevisions"
        | "alltransclusions"
        | "backlinks"
        | "categories"
        | "categorymembers"
        | "contenttranslation"
        | "contenttranslationsuggestions"
        | "deletedrevisions"
        | "duplicatefiles"
        | "embeddedin"
        | "exturlusage"
        | "fileusage"
        | "geosearch"
        | "gettingstartedgetpages"
        | "images"
        | "imageusage"
        | "iwbacklinks"
        | "langbacklinks"
        | "links"
        | "linkshere"
        | "mostviewed"
        | "oldreviewedpages"
        | "pageswithprop"
        | "prefixsearch"
        | "projectpages"
        | "protectedtitles"
        | "querypage"
        | "random"
        | "recentchanges"
        | "redirects"
        | "revisions"
        | "search"
        | "templates"
        | "transcludedin"
        | "watchlist"
        | "watchlistraw"
        | "wblistentityusage"
        | "readinglistentries";
    redirects?: boolean;
    converttitles?: boolean;
    token?: string;
}

export interface ApiParamsSetPageLanguage extends ApiParams {
    title?: string;
    pageid?: number;
    lang?:
        | "ab"
        | "abs"
        | "ace"
        | "ady"
        | "ady-cyrl"
        | "aeb"
        | "aeb-arab"
        | "aeb-latn"
        | "af"
        | "ak"
        | "aln"
        | "alt"
        | "am"
        | "ami"
        | "an"
        | "ang"
        | "anp"
        | "ar"
        | "arc"
        | "arn"
        | "arq"
        | "ary"
        | "arz"
        | "as"
        | "ase"
        | "ast"
        | "atj"
        | "av"
        | "avk"
        | "awa"
        | "ay"
        | "az"
        | "azb"
        | "ba"
        | "ban"
        | "ban-bali"
        | "bar"
        | "bbc"
        | "bbc-latn"
        | "bcc"
        | "bcl"
        | "be"
        | "be-tarask"
        | "bg"
        | "bgn"
        | "bh"
        | "bho"
        | "bi"
        | "bjn"
        | "bm"
        | "bn"
        | "bo"
        | "bpy"
        | "bqi"
        | "br"
        | "brh"
        | "bs"
        | "btm"
        | "bto"
        | "bug"
        | "bxr"
        | "ca"
        | "cbk-zam"
        | "cdo"
        | "ce"
        | "ceb"
        | "ch"
        | "chr"
        | "chy"
        | "ckb"
        | "co"
        | "cps"
        | "cr"
        | "crh"
        | "crh-cyrl"
        | "crh-latn"
        | "cs"
        | "csb"
        | "cu"
        | "cv"
        | "cy"
        | "da"
        | "de"
        | "de-at"
        | "de-ch"
        | "de-formal"
        | "default"
        | "din"
        | "diq"
        | "dsb"
        | "dtp"
        | "dty"
        | "dv"
        | "dz"
        | "ee"
        | "egl"
        | "el"
        | "eml"
        | "en"
        | "en-ca"
        | "en-gb"
        | "eo"
        | "es"
        | "es-formal"
        | "et"
        | "eu"
        | "ext"
        | "fa"
        | "ff"
        | "fi"
        | "fit"
        | "fj"
        | "fo"
        | "fr"
        | "frc"
        | "frp"
        | "frr"
        | "fur"
        | "fy"
        | "ga"
        | "gag"
        | "gan"
        | "gan-hans"
        | "gan-hant"
        | "gcr"
        | "gd"
        | "gl"
        | "glk"
        | "gn"
        | "gom"
        | "gom-deva"
        | "gom-latn"
        | "gor"
        | "got"
        | "grc"
        | "gsw"
        | "gu"
        | "guc"
        | "gv"
        | "ha"
        | "hak"
        | "haw"
        | "he"
        | "hi"
        | "hif"
        | "hif-latn"
        | "hil"
        | "hr"
        | "hrx"
        | "hsb"
        | "ht"
        | "hu"
        | "hu-formal"
        | "hy"
        | "hyw"
        | "ia"
        | "id"
        | "ie"
        | "ig"
        | "ii"
        | "ik"
        | "ike-cans"
        | "ike-latn"
        | "ilo"
        | "inh"
        | "io"
        | "is"
        | "it"
        | "iu"
        | "ja"
        | "jam"
        | "jbo"
        | "jut"
        | "jv"
        | "ka"
        | "kaa"
        | "kab"
        | "kbd"
        | "kbd-cyrl"
        | "kbp"
        | "kcg"
        | "kg"
        | "khw"
        | "ki"
        | "kiu"
        | "kjp"
        | "kk"
        | "kk-arab"
        | "kk-cn"
        | "kk-cyrl"
        | "kk-kz"
        | "kk-latn"
        | "kk-tr"
        | "kl"
        | "km"
        | "kn"
        | "ko"
        | "ko-kp"
        | "koi"
        | "krc"
        | "kri"
        | "krj"
        | "krl"
        | "ks"
        | "ks-arab"
        | "ks-deva"
        | "ksh"
        | "ku"
        | "ku-arab"
        | "ku-latn"
        | "kum"
        | "kv"
        | "kw"
        | "ky"
        | "la"
        | "lad"
        | "lb"
        | "lbe"
        | "lez"
        | "lfn"
        | "lg"
        | "li"
        | "lij"
        | "liv"
        | "lki"
        | "lld"
        | "lmo"
        | "ln"
        | "lo"
        | "loz"
        | "lrc"
        | "lt"
        | "ltg"
        | "lus"
        | "luz"
        | "lv"
        | "lzh"
        | "lzz"
        | "mad"
        | "mai"
        | "map-bms"
        | "mdf"
        | "mg"
        | "mhr"
        | "mi"
        | "min"
        | "mk"
        | "ml"
        | "mn"
        | "mni"
        | "mnw"
        | "mo"
        | "mr"
        | "mrh"
        | "mrj"
        | "ms"
        | "mt"
        | "mwl"
        | "my"
        | "myv"
        | "mzn"
        | "na"
        | "nah"
        | "nan"
        | "nap"
        | "nb"
        | "nds"
        | "nds-nl"
        | "ne"
        | "new"
        | "nia"
        | "niu"
        | "nl"
        | "nl-informal"
        | "nn"
        | "nov"
        | "nqo"
        | "nrm"
        | "nso"
        | "nv"
        | "ny"
        | "nys"
        | "oc"
        | "olo"
        | "om"
        | "or"
        | "os"
        | "pa"
        | "pag"
        | "pam"
        | "pap"
        | "pcd"
        | "pdc"
        | "pdt"
        | "pfl"
        | "pi"
        | "pih"
        | "pl"
        | "pms"
        | "pnb"
        | "pnt"
        | "prg"
        | "ps"
        | "pt"
        | "pt-br"
        | "qu"
        | "qug"
        | "rgn"
        | "rif"
        | "rm"
        | "rmy"
        | "ro"
        | "roa-tara"
        | "ru"
        | "rue"
        | "rup"
        | "ruq"
        | "ruq-cyrl"
        | "ruq-latn"
        | "rw"
        | "sa"
        | "sah"
        | "sat"
        | "sc"
        | "scn"
        | "sco"
        | "sd"
        | "sdc"
        | "sdh"
        | "se"
        | "sei"
        | "ses"
        | "sg"
        | "sgs"
        | "sh"
        | "shi"
        | "shn"
        | "shy"
        | "shy-latn"
        | "si"
        | "sk"
        | "skr"
        | "skr-arab"
        | "sl"
        | "sli"
        | "sm"
        | "sma"
        | "smn"
        | "sn"
        | "so"
        | "sq"
        | "sr"
        | "sr-ec"
        | "sr-el"
        | "srn"
        | "ss"
        | "st"
        | "stq"
        | "sty"
        | "su"
        | "sv"
        | "sw"
        | "szl"
        | "szy"
        | "ta"
        | "tay"
        | "tcy"
        | "te"
        | "tet"
        | "tg"
        | "tg-cyrl"
        | "tg-latn"
        | "th"
        | "ti"
        | "tk"
        | "tl"
        | "tly"
        | "tn"
        | "to"
        | "tpi"
        | "tr"
        | "tru"
        | "trv"
        | "ts"
        | "tt"
        | "tt-cyrl"
        | "tt-latn"
        | "tw"
        | "ty"
        | "tyv"
        | "tzm"
        | "udm"
        | "ug"
        | "ug-arab"
        | "ug-latn"
        | "uk"
        | "ur"
        | "uz"
        | "ve"
        | "vec"
        | "vep"
        | "vi"
        | "vls"
        | "vmf"
        | "vo"
        | "vot"
        | "vro"
        | "wa"
        | "war"
        | "wo"
        | "wuu"
        | "xal"
        | "xh"
        | "xmf"
        | "xsy"
        | "yi"
        | "yo"
        | "yue"
        | "za"
        | "zea"
        | "zgh"
        | "zh"
        | "zh-cn"
        | "zh-hans"
        | "zh-hant"
        | "zh-hk"
        | "zh-mo"
        | "zh-my"
        | "zh-sg"
        | "zh-tw"
        | "zu";
    reason?: string;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsShortenUrl extends ApiParams {
    url?: string;
}

export interface SiteMatrixApiSiteMatrixParams extends ApiParams {
    /** One or more of the following: "language" | "special" */
    type?: string;
    /** One or more of the following: "all" | "closed" | "fishbowl" | "nonglobal" | "private" */
    state?: string;
    /** One or more of the following: "code" | "dir" | "localname" | "name" | "site" */
    langprop?: string;
    /** One or more of the following: "code" | "dbname" | "lang" | "sitename" | "url" */
    siteprop?: string;
    limit?: limit;
    continue?: string;
}

export interface ApiParamsSpamBlacklist extends ApiParams {
    url?: string | string[];
}

export interface ApiParamsStabilizeProtect extends ApiParams {
    protectlevel?: "autoconfirmed" | "none";
    expiry?: string;
    reason?: string;
    watch?: string;
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    title?: string;
    token?: string;
}

export interface ApiParamsStashEdit extends ApiParams {
    title?: string;
    section?: string;
    sectiontitle?: string;
    text?: string;
    stashedtexthash?: string;
    summary?: string;
    contentmodel?:
        | "GadgetDefinition"
        | "JsonSchema"
        | "MassMessageListContent"
        | "Scribunto"
        | "SecurePoll"
        | "css"
        | "javascript"
        | "json"
        | "sanitized-css"
        | "text"
        | "unknown"
        | "wikitext";
    contentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    baserevid?: number;
    token?: string;
}

export interface EventStreamConfigApiStreamConfigsParams extends ApiParams {
    streams?: string | string[];
    constraints?: string | string[];
    all_settings?: boolean;
}

export interface SecurePollApiStrikeVoteParams extends ApiParams {
    option?: "strike" | "unstrike";
    reason?: string;
    voteid?: number;
    token?: string;
}

export interface ApiParamsTag extends ApiParams {
    rcid?: number | number[];
    revid?: number | number[];
    logid?: number | number[];
    /** One or more of the following: "AWB" | "Image up for deletion on Commons" | "Manual revert" | "ProveIt edit" | "RedWarn" | "STiki" | "WPCleaner" | "WikiLoop Battlefield" | "bot trial" | "discretionary" | "editProtectedHelper" | "huggle" | "large non-free file" | "possible birth or death date change" | "self-published-blog" | "self-published source" | "twinkle" */
    add?: string;
    remove?: string | string[];
    reason?: string;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsTemplateData extends ApiParams {
    includeMissingTitles?: boolean;
    doNotIgnoreMissingTitles?: boolean;
    lang?: string;
    titles?: string | string[];
    pageids?: number | number[];
    revids?: number | number[];
    generator?:
        | "allcategories"
        | "alldeletedrevisions"
        | "allfileusages"
        | "allimages"
        | "alllinks"
        | "allpages"
        | "allredirects"
        | "allrevisions"
        | "alltransclusions"
        | "backlinks"
        | "categories"
        | "categorymembers"
        | "contenttranslation"
        | "contenttranslationsuggestions"
        | "deletedrevisions"
        | "duplicatefiles"
        | "embeddedin"
        | "exturlusage"
        | "fileusage"
        | "geosearch"
        | "gettingstartedgetpages"
        | "images"
        | "imageusage"
        | "iwbacklinks"
        | "langbacklinks"
        | "links"
        | "linkshere"
        | "mostviewed"
        | "oldreviewedpages"
        | "pageswithprop"
        | "prefixsearch"
        | "projectpages"
        | "protectedtitles"
        | "querypage"
        | "random"
        | "recentchanges"
        | "redirects"
        | "revisions"
        | "search"
        | "templates"
        | "transcludedin"
        | "watchlist"
        | "watchlistraw"
        | "wblistentityusage"
        | "readinglistentries";
    redirects?: boolean;
    converttitles?: boolean;
}

export interface ApiParamsCoreThank extends ApiParams {
    rev?: number;
    log?: number;
    token?: string;
    source?: string;
}

export interface ApiParamsTimedText extends ApiParams {
    title?: string;
    pageid?: number;
    trackformat?: "srt" | "vtt";
    lang?: string;
}

export interface ApiParamsQueryTitleBlacklist extends ApiParams {
    title?: string;
    action?: "create" | "createpage" | "createtalk" | "edit" | "move" | "new-account" | "upload";
    nooverride?: boolean;
}

export interface ApiParamsTokens extends ApiParams {
    /** One or more of the following: "block" | "createaccount" | "csrf" | "delete" | "deleteglobalaccount" | "edit" | "email" | "import" | "login" | "move" | "options" | "patrol" | "protect" | "rollback" | "setglobalaccountstatus" | "unblock" | "userrights" | "watch" */
    type?: string;
}

export interface ApiParamsTranscodeReset extends ApiParams {
    title?: string;
    transcodekey?: string;
    token?: string;
}

export interface ApiParamsULSLocalization extends ApiParams {
    language?: string;
}

export interface ApiParamsULSSetLanguage extends ApiParams {
    languagecode?: string;
    token?: string;
}

export interface ApiParamsUnblock extends ApiParams {
    id?: number;
    user?: string;
    userid?: number;
    reason?: string;
    tags?: string | string[];
    token?: string;
}

export interface ApiParamsUndelete extends ApiParams {
    title?: string;
    reason?: string;
    tags?: string | string[];
    timestamps?: timestamp | timestamp[];
    fileids?: number | number[];
    watchlist?: "nochange" | "preferences" | "unwatch" | "watch";
    watchlistexpiry?: expiry;
    token?: string;
}

export interface ApiParamsRemoveAuthenticationData extends ApiParams {
    request?: string;
    token?: string;
}

export interface ApiParamsUpload extends ApiParams {
    filename?: string;
    comment?: string;
    tags?: string | string[];
    text?: string;
    watch?: boolean;
    watchlist?: "nochange" | "preferences" | "watch";
    watchlistexpiry?: expiry;
    ignorewarnings?: boolean;
    file?: upload;
    url?: string;
    filekey?: string;
    sessionkey?: string;
    stash?: boolean;
    filesize?: number;
    offset?: number;
    chunk?: upload;
    async?: boolean;
    checkstatus?: boolean;
    token?: string;
}

export interface ApiParamsUserrights extends ApiParams {
    user?: string;
    userid?: number;
    /** One or more of the following: "abusefilter" | "abusefilter-helper" | "accountcreator" | "autoreviewer" | "bot" | "bureaucrat" | "checkuser" | "confirmed" | "copyviobot" | "eventcoordinator" | "extendedconfirmed" | "extendedmover" | "filemover" | "founder" | "import" | "interface-admin" | "ipblock-exempt" | "massmessage-sender" | "oversight" | "patroller" | "researcher" | "reviewer" | "rollbacker" | "steward" | "sysop" | "templateeditor" | "transwiki" */
    add?: string;
    expiry?: string | string[];
    /** One or more of the following: "abusefilter" | "abusefilter-helper" | "accountcreator" | "autoreviewer" | "bot" | "bureaucrat" | "checkuser" | "confirmed" | "copyviobot" | "eventcoordinator" | "extendedconfirmed" | "extendedmover" | "filemover" | "founder" | "import" | "interface-admin" | "ipblock-exempt" | "massmessage-sender" | "oversight" | "patroller" | "researcher" | "reviewer" | "rollbacker" | "steward" | "sysop" | "templateeditor" | "transwiki" */
    remove?: string;
    reason?: string;
    token?: string;
    tags?: string | string[];
}

export interface ApiParamsValidatePassword extends ApiParams {
    password?: password;
    user?: string;
    email?: string;
    realname?: string;
}

export interface ApiParamsVisualEditor extends ApiParams {
    page?: string;
    badetag?: string;
    format?: "json" | "jsonfm";
    paction?: "metadata" | "parse" | "parsedoc" | "parsefragment" | "templatesused" | "wikitext";
    wikitext?: string;
    section?: string;
    stash?: string;
    oldid?: string;
    editintro?: string;
    pst?: boolean;
    preload?: string;
    preloadparams?: string | string[];
}

export interface ApiParamsVisualEditorEdit extends ApiParams {
    paction?: "diff" | "save" | "serialize" | "serializeforcache";
    page?: string;
    token?: string;
    wikitext?: string;
    section?: string;
    sectiontitle?: string;
    basetimestamp?: string;
    starttimestamp?: string;
    oldid?: string;
    minor?: string;
    watchlist?: string;
    html?: string;
    etag?: string;
    summary?: string;
    captchaid?: string;
    captchaword?: string;
    cachekey?: string;
    tags?: string | string[];
}

export interface ApiParamsWatch extends ApiParams {
    title?: string;
    expiry?: expiry;
    unwatch?: boolean;
    continue?: string;
    titles?: string | string[];
    pageids?: number | number[];
    revids?: number | number[];
    generator?:
        | "allcategories"
        | "alldeletedrevisions"
        | "allfileusages"
        | "allimages"
        | "alllinks"
        | "allpages"
        | "allredirects"
        | "allrevisions"
        | "alltransclusions"
        | "backlinks"
        | "categories"
        | "categorymembers"
        | "contenttranslation"
        | "contenttranslationsuggestions"
        | "deletedrevisions"
        | "duplicatefiles"
        | "embeddedin"
        | "exturlusage"
        | "fileusage"
        | "geosearch"
        | "gettingstartedgetpages"
        | "images"
        | "imageusage"
        | "iwbacklinks"
        | "langbacklinks"
        | "links"
        | "linkshere"
        | "mostviewed"
        | "oldreviewedpages"
        | "pageswithprop"
        | "prefixsearch"
        | "projectpages"
        | "protectedtitles"
        | "querypage"
        | "random"
        | "recentchanges"
        | "redirects"
        | "revisions"
        | "search"
        | "templates"
        | "transcludedin"
        | "watchlist"
        | "watchlistraw"
        | "wblistentityusage"
        | "readinglistentries";
    redirects?: boolean;
    converttitles?: boolean;
    token?: string;
}

export interface MobileFrontendApiWebappManifestParams extends ApiParams {}

export interface WebAuthnApiWebAuthnParams extends ApiParams {
    func?: string;
    data?: string;
}

export interface WikiLoveApiWikiLoveParams extends ApiParams {
    title?: string;
    text?: string;
    message?: string;
    token?: string;
    subject?: string;
    type?: string;
    email?: string;
    tags?: string | string[];
}

export interface ApiParamsFormatXml extends ApiParams {
    xslt?: string;
    includexmlnamespace?: boolean;
}

export interface ApiParamsFormatXml extends ApiParams {
    wrappedhtml?: boolean;
    xslt?: string;
    includexmlnamespace?: boolean;
}

export interface AbuseFilterApiQueryAbuseFiltersParams extends ApiParamsQuery {
    abfstartid?: number;
    abfendid?: number;
    abfdir?: "newer" | "older";
    /** One or more of the following: "!deleted" | "!enabled" | "!private" | "deleted" | "enabled" | "private" */
    abfshow?: string;
    abflimit?: limit;
    /** One or more of the following: "actions" | "comments" | "description" | "hits" | "id" | "lasteditor" | "lastedittime" | "pattern" | "private" | "status" */
    abfprop?: string;
}

export interface AbuseFilterApiQueryAbuseLogParams extends ApiParamsQuery {
    afllogid?: number;
    aflstart?: timestamp;
    aflend?: timestamp;
    afldir?: "newer" | "older";
    afluser?: string;
    afltitle?: string;
    aflfilter?: string | string[];
    afllimit?: limit;
    /** One or more of the following: "action" | "details" | "filter" | "hidden" | "ids" | "result" | "revid" | "timestamp" | "title" | "user" */
    aflprop?: string;
}

export interface ApiParamsQueryAllCategories extends ApiParamsQuery {
    acfrom?: string;
    accontinue?: string;
    acto?: string;
    acprefix?: string;
    acdir?: "ascending" | "descending";
    acmin?: number;
    acmax?: number;
    aclimit?: limit;
    /** One or more of the following: "hidden" | "size" */
    acprop?: string;
}

export interface ApiParamsQueryAllDeletedRevisions extends ApiParamsQuery {
    /** One or more of the following: "comment" | "content" | "contentmodel" | "flags" | "ids" | "parsedcomment" | "roles" | "sha1" | "size" | "slotsha1" | "slotsize" | "tags" | "timestamp" | "user" | "userid" | "parsetree" */
    adrprop?: string;
    /** One or more of the following: "main" */
    adrslots?: string;
    adrlimit?: limit;
    adrexpandtemplates?: boolean;
    adrgeneratexml?: boolean;
    adrparse?: boolean;
    adrsection?: string;
    adrdiffto?: string;
    adrdifftotext?: string;
    adrdifftotextpst?: boolean;
    adrcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    adruser?: string;
    adrnamespace?: namespace | namespace[];
    adrstart?: timestamp;
    adrend?: timestamp;
    adrdir?: "newer" | "older";
    adrfrom?: string;
    adrto?: string;
    adrprefix?: string;
    adrexcludeuser?: string;
    adrtag?: string;
    adrcontinue?: string;
    adrgeneratetitles?: boolean;
}

export interface ApiParamsQueryAllLinks extends ApiParamsQuery {
    afcontinue?: string;
    affrom?: string;
    afto?: string;
    afprefix?: string;
    afunique?: boolean;
    /** One or more of the following: "ids" | "title" */
    afprop?: string;
    aflimit?: limit;
    afdir?: "ascending" | "descending";
}

export interface ApiParamsQueryAllImages extends ApiParamsQuery {
    aisort?: "name" | "timestamp";
    aidir?: "ascending" | "descending" | "newer" | "older";
    aifrom?: string;
    aito?: string;
    aicontinue?: string;
    aistart?: timestamp;
    aiend?: timestamp;
    /** One or more of the following: "badfile" | "bitdepth" | "canonicaltitle" | "comment" | "commonmetadata" | "dimensions" | "extmetadata" | "mediatype" | "metadata" | "mime" | "parsedcomment" | "sha1" | "size" | "timestamp" | "url" | "user" | "userid" */
    aiprop?: string;
    aiprefix?: string;
    aiminsize?: number;
    aimaxsize?: number;
    aisha1?: string;
    aisha1base36?: string;
    aiuser?: string;
    aifilterbots?: "all" | "bots" | "nobots";
    aimime?: string | string[];
    ailimit?: limit;
}

export interface ApiParamsQueryAllLinks extends ApiParamsQuery {
    alcontinue?: string;
    alfrom?: string;
    alto?: string;
    alprefix?: string;
    alunique?: boolean;
    /** One or more of the following: "ids" | "title" */
    alprop?: string;
    alnamespace?: namespace;
    allimit?: limit;
    aldir?: "ascending" | "descending";
}

export interface ApiParamsQueryAllMessages extends ApiParamsQuery {
    ammessages?: string | string[];
    /** One or more of the following: "default" */
    amprop?: string;
    amenableparser?: boolean;
    amnocontent?: boolean;
    amincludelocal?: boolean;
    amargs?: string | string[];
    amfilter?: string;
    amcustomised?: "all" | "modified" | "unmodified";
    amlang?: string;
    amfrom?: string;
    amto?: string;
    amtitle?: string;
    amprefix?: string;
}

export interface ApiParamsQueryAllPages extends ApiParamsQuery {
    apfrom?: string;
    apcontinue?: string;
    apto?: string;
    apprefix?: string;
    apnamespace?: namespace;
    apfilterredir?: "all" | "nonredirects" | "redirects";
    apminsize?: number;
    apmaxsize?: number;
    /** One or more of the following: "edit" | "move" | "upload" */
    apprtype?: string;
    /** One or more of the following: "" | "autoconfirmed" | "extendedconfirmed" | "sysop" | "templateeditor" */
    apprlevel?: string;
    apprfiltercascade?: "all" | "cascading" | "noncascading";
    aplimit?: limit;
    apdir?: "ascending" | "descending";
    apfilterlanglinks?: "all" | "withlanglinks" | "withoutlanglinks";
    apprexpiry?: "all" | "definite" | "indefinite";
}

export interface ApiParamsQueryAllLinks extends ApiParamsQuery {
    arcontinue?: string;
    arfrom?: string;
    arto?: string;
    arprefix?: string;
    arunique?: boolean;
    /** One or more of the following: "fragment" | "ids" | "interwiki" | "title" */
    arprop?: string;
    arnamespace?: namespace;
    arlimit?: limit;
    ardir?: "ascending" | "descending";
}

export interface ApiParamsQueryAllRevisions extends ApiParamsQuery {
    /** One or more of the following: "comment" | "content" | "contentmodel" | "flags" | "ids" | "oresscores" | "parsedcomment" | "roles" | "sha1" | "size" | "slotsha1" | "slotsize" | "tags" | "timestamp" | "user" | "userid" | "parsetree" */
    arvprop?: string;
    /** One or more of the following: "main" */
    arvslots?: string;
    arvlimit?: limit;
    arvexpandtemplates?: boolean;
    arvgeneratexml?: boolean;
    arvparse?: boolean;
    arvsection?: string;
    arvdiffto?: string;
    arvdifftotext?: string;
    arvdifftotextpst?: boolean;
    arvcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    arvuser?: string;
    arvnamespace?: namespace | namespace[];
    arvstart?: timestamp;
    arvend?: timestamp;
    arvdir?: "newer" | "older";
    arvexcludeuser?: string;
    arvcontinue?: string;
    arvgeneratetitles?: boolean;
}

export interface ApiParamsQueryAllLinks extends ApiParamsQuery {
    atcontinue?: string;
    atfrom?: string;
    atto?: string;
    atprefix?: string;
    atunique?: boolean;
    /** One or more of the following: "ids" | "title" */
    atprop?: string;
    atnamespace?: namespace;
    atlimit?: limit;
    atdir?: "ascending" | "descending";
}

export interface ApiParamsQueryAllUsers extends ApiParamsQuery {
    aufrom?: string;
    auto?: string;
    auprefix?: string;
    audir?: "ascending" | "descending";
    /** One or more of the following: "abusefilter" | "abusefilter-helper" | "accountcreator" | "autoreviewer" | "bot" | "bureaucrat" | "checkuser" | "confirmed" | "copyviobot" | "eventcoordinator" | "extendedconfirmed" | "extendedmover" | "filemover" | "founder" | "import" | "interface-admin" | "ipblock-exempt" | "massmessage-sender" | "oversight" | "patroller" | "researcher" | "reviewer" | "rollbacker" | "steward" | "sysop" | "templateeditor" | "transwiki" */
    augroup?: string;
    /** One or more of the following: "abusefilter" | "abusefilter-helper" | "accountcreator" | "autoreviewer" | "bot" | "bureaucrat" | "checkuser" | "confirmed" | "copyviobot" | "eventcoordinator" | "extendedconfirmed" | "extendedmover" | "filemover" | "founder" | "import" | "interface-admin" | "ipblock-exempt" | "massmessage-sender" | "oversight" | "patroller" | "researcher" | "reviewer" | "rollbacker" | "steward" | "sysop" | "templateeditor" | "transwiki" */
    auexcludegroup?: string;
    /** One or more of the following: "abusefilter-hidden-log" | "abusefilter-hide-log" | "abusefilter-log" | "abusefilter-log-detail" | "abusefilter-log-private" | "abusefilter-modify" | "abusefilter-modify-global" | "abusefilter-modify-restricted" | "abusefilter-privatedetails" | "abusefilter-privatedetails-log" | "abusefilter-revert" | "abusefilter-view" | "abusefilter-view-private" | "apihighlimits" | "applychangetags" | "autoconfirmed" | "autocreateaccount" | "autopatrol" | "autoreview" | "autoreviewrestore" | "bigdelete" | "block" | "blockemail" | "bot" | "browsearchive" | "centralauth-createlocal" | "centralauth-lock" | "centralauth-merge" | "centralauth-oversight" | "centralauth-rename" | "centralauth-unmerge" | "centralauth-usermerge" | "changetags" | "checkuser" | "checkuser-log" | "collectionsaveascommunitypage" | "collectionsaveasuserpage" | "createaccount" | "createpage" | "createpagemainns" | "createtalk" | "delete" | "delete-redirect" | "deletechangetags" | "deletedhistory" | "deletedtext" | "deletelogentry" | "deleterevision" | "edit" | "editautoreviewprotected" | "editcontentmodel" | "editeditorprotected" | "editextendedsemiprotected" | "editinterface" | "editmyoptions" | "editmyprivateinfo" | "editmyusercss" | "editmyuserjs" | "editmyuserjson" | "editmyuserjsredirect" | "editmywatchlist" | "editprotected" | "editsemiprotected" | "editsitecss" | "editsitejs" | "editsitejson" | "editusercss" | "edituserjs" | "edituserjson" | "extendedconfirmed" | "flow-create-board" | "flow-delete" | "flow-edit-post" | "flow-hide" | "flow-suppress" | "gadgets-definition-edit" | "gadgets-edit" | "globalblock" | "globalblock-exempt" | "globalblock-whitelist" | "globalgroupmembership" | "globalgrouppermissions" | "gwtoolset" | "hideuser" | "import" | "importupload" | "ipblock-exempt" | "manage-all-push-subscriptions" | "managechangetags" | "markbotedits" | "massmessage" | "mergehistory" | "minoredit" | "move" | "move-categorypages" | "move-rootuserpages" | "move-subpages" | "movefile" | "movestable" | "mwoauthmanageconsumer" | "mwoauthmanagemygrants" | "mwoauthproposeconsumer" | "mwoauthsuppress" | "mwoauthupdateownconsumer" | "mwoauthviewprivate" | "mwoauthviewsuppressed" | "newsletter-create" | "newsletter-delete" | "newsletter-manage" | "newsletter-restore" | "nominornewtalk" | "noratelimit" | "nuke" | "oathauth-api-all" | "oathauth-disable-for-user" | "oathauth-enable" | "oathauth-verify-user" | "oathauth-view-log" | "override-antispoof" | "override-export-depth" | "pagelang" | "pagetriage-copyvio" | "patrol" | "patrolmarks" | "protect" | "purge" | "read" | "renameuser" | "reupload" | "reupload-own" | "reupload-shared" | "review" | "rollback" | "securepoll-create-poll" | "sendemail" | "setmentor" | "siteadmin" | "skipcaptcha" | "spamblacklistlog" | "stablesettings" | "suppressionlog" | "suppressredirect" | "suppressrevision" | "tboverride" | "tboverride-account" | "templateeditor" | "titleblacklistlog" | "torunblocked" | "transcode-reset" | "transcode-status" | "unblockself" | "undelete" | "unreviewedpages" | "unwatchedpages" | "upload" | "upload_by_url" | "urlshortener-create-url" | "urlshortener-manage-url" | "urlshortener-view-log" | "usermerge" | "userrights" | "userrights-interwiki" | "validate" | "viewdeletedfile" | "viewmyprivateinfo" | "viewmywatchlist" | "viewsuppressed" | "vipsscaler-test" | "writeapi" */
    aurights?: string;
    /** One or more of the following: "blockinfo" | "centralids" | "editcount" | "groups" | "implicitgroups" | "registration" | "rights" */
    auprop?: string;
    aulimit?: limit;
    auwitheditsonly?: boolean;
    auactiveusers?: boolean;
    auattachedwiki?: string;
}

export interface ApiParamsQueryAuthManagerInfo extends ApiParamsQuery {
    amisecuritysensitiveoperation?: string;
    amirequestsfor?:
        | "change"
        | "create"
        | "create-continue"
        | "link"
        | "link-continue"
        | "login"
        | "login-continue"
        | "remove"
        | "unlink";
    amimergerequestfields?: boolean;
    amimessageformat?: "html" | "none" | "raw" | "wikitext";
}

export interface MediaWikiBabelApiQueryBabelParams extends ApiParamsQuery {
    babuser?: string;
}

export interface ApiParamsQueryBacklinks extends ApiParamsQuery {
    bltitle?: string;
    blpageid?: number;
    blcontinue?: string;
    blnamespace?: namespace | namespace[];
    bldir?: "ascending" | "descending";
    blfilterredir?: "all" | "nonredirects" | "redirects";
    bllimit?: limit;
    blredirect?: boolean;
}

export interface ApiParamsQueryBetaFeatures extends ApiParamsQuery {
    bfcounts?: string;
}

export interface ApiParamsQueryBlocks extends ApiParamsQuery {
    bkstart?: timestamp;
    bkend?: timestamp;
    bkdir?: "newer" | "older";
    bkids?: number | number[];
    bkusers?: string | string[];
    bkip?: string;
    bklimit?: limit;
    /** One or more of the following: "by" | "byid" | "expiry" | "flags" | "id" | "range" | "reason" | "restrictions" | "timestamp" | "user" | "userid" */
    bkprop?: string;
     /** One or more of the following: "!account" | "!ip" | "!range" | "!temp" | "account" | "ip" | "range" | "temp" */
    bkshow?: string;
    bkcontinue?: string;
}

export interface ApiParamsQueryCategories extends ApiParamsQuery {
    /** One or more of the following: "hidden" | "sortkey" | "timestamp" */
    clprop?: string;
    /** One or more of the following: "!hidden" | "hidden" */
    clshow?: string;
    cllimit?: limit;
    clcontinue?: string;
    clcategories?: string | string[];
    cldir?: "ascending" | "descending";
}

export interface ApiParamsQueryCategoryInfo extends ApiParamsQuery {
    cicontinue?: string;
}

export interface ApiParamsQueryCategoryMembers extends ApiParamsQuery {
    cmtitle?: string;
    cmpageid?: number;
    /** One or more of the following: "ids" | "sortkey" | "sortkeyprefix" | "timestamp" | "title" | "type" */
    cmprop?: string;
    cmnamespace?: namespace | namespace[];
    /** One or more of the following: "file" | "page" | "subcat" */
    cmtype?: string;
    cmcontinue?: string;
    cmlimit?: limit;
    cmsort?: "sortkey" | "timestamp";
    cmdir?: "asc" | "ascending" | "desc" | "descending" | "newer" | "older";
    cmstart?: timestamp;
    cmend?: timestamp;
    cmstarthexsortkey?: string;
    cmendhexsortkey?: string;
    cmstartsortkeyprefix?: string;
    cmendsortkeyprefix?: string;
    cmstartsortkey?: string;
    cmendsortkey?: string;
}

export interface ApiParamsCentralNoticeQueryActiveCampaigns extends ApiParamsQuery {
    cnacincludefuture?: boolean;
}

export interface ApiParamsCentralNoticeLogs extends ApiParamsQuery {
    campaign?: string;
    user?: string;
    limit?: limit;
    offset?: number;
    start?: timestamp;
    end?: timestamp;
}

export interface MediaWikiCheckUserApiQueryCheckUserParams extends ApiParamsQuery {
    curequest?: "edits" | "ipusers" | "userips";
    cutarget?: string;
    cureason?: string;
    culimit?: limit;
    cutimecond?: string;
    cuxff?: string;
    cutoken?: string;
}

export interface MediaWikiCheckUserApiQueryCheckUserLogParams extends ApiParamsQuery {
    culuser?: string;
    cultarget?: string;
    cullimit?: limit;
    culdir?: "newer" | "older";
    culfrom?: timestamp;
    culto?: timestamp;
    culcontinue?: string;
}

export interface CirrusSearchApiQueryBuildDocumentParams extends ApiParamsQuery {}

export interface CirrusSearchApiQueryCompSuggestBuildDocParams extends ApiParamsQuery {
    csbmethod?: string;
}

export interface CirrusSearchApiQueryCirrusDocParams extends ApiParamsQuery {}

export interface ApiParamsQueryContentTranslation extends ApiParamsQuery {
    translationid?: string;
    from?: string;
    to?: string;
    sourcetitle?: string;
    limit?: limit;
    offset?: string;
    type?: "draft" | "published";
}

export interface ApiParamsQueryContentTranslationCorpora extends ApiParamsQuery {
    translationid?: number;
    striphtml?: boolean;
    /** One or more of the following: "mt" | "source" | "user" */
    types?: string;
}

export interface ApiParamsQueryContentTranslationLanguageTrend extends ApiParamsQuery {
    source?: string;
    target?: string;
    interval?: "month" | "week";
}

export interface ApiParamsQueryContentTranslationStats extends ApiParamsQuery {}

export interface ApiParamsQueryContentTranslationSuggestions extends ApiParamsQuery {
    from?: string;
    to?: string;
    listid?: string;
    limit?: limit;
    offset?: string;
    seed?: number;
}

export interface ApiParamsQueryContributors extends ApiParamsQuery {
    /** One or more of the following: "abusefilter" | "abusefilter-helper" | "accountcreator" | "autoreviewer" | "bot" | "bureaucrat" | "checkuser" | "confirmed" | "copyviobot" | "eventcoordinator" | "extendedconfirmed" | "extendedmover" | "filemover" | "founder" | "import" | "interface-admin" | "ipblock-exempt" | "massmessage-sender" | "oversight" | "patroller" | "researcher" | "reviewer" | "rollbacker" | "steward" | "sysop" | "templateeditor" | "transwiki" */
    pcgroup?: string;
    /** One or more of the following: "abusefilter" | "abusefilter-helper" | "accountcreator" | "autoreviewer" | "bot" | "bureaucrat" | "checkuser" | "confirmed" | "copyviobot" | "eventcoordinator" | "extendedconfirmed" | "extendedmover" | "filemover" | "founder" | "import" | "interface-admin" | "ipblock-exempt" | "massmessage-sender" | "oversight" | "patroller" | "researcher" | "reviewer" | "rollbacker" | "steward" | "sysop" | "templateeditor" | "transwiki" */
    pcexcludegroup?: string;
    /** One or more of the following: "abusefilter-hidden-log" | "abusefilter-hide-log" | "abusefilter-log" | "abusefilter-log-detail" | "abusefilter-log-private" | "abusefilter-modify" | "abusefilter-modify-global" | "abusefilter-modify-restricted" | "abusefilter-privatedetails" | "abusefilter-privatedetails-log" | "abusefilter-revert" | "abusefilter-view" | "abusefilter-view-private" | "apihighlimits" | "applychangetags" | "autoconfirmed" | "autocreateaccount" | "autopatrol" | "autoreview" | "autoreviewrestore" | "bigdelete" | "block" | "blockemail" | "bot" | "browsearchive" | "centralauth-createlocal" | "centralauth-lock" | "centralauth-merge" | "centralauth-oversight" | "centralauth-rename" | "centralauth-unmerge" | "centralauth-usermerge" | "changetags" | "checkuser" | "checkuser-log" | "collectionsaveascommunitypage" | "collectionsaveasuserpage" | "createaccount" | "createpage" | "createpagemainns" | "createtalk" | "delete" | "delete-redirect" | "deletechangetags" | "deletedhistory" | "deletedtext" | "deletelogentry" | "deleterevision" | "edit" | "editautoreviewprotected" | "editcontentmodel" | "editeditorprotected" | "editextendedsemiprotected" | "editinterface" | "editmyoptions" | "editmyprivateinfo" | "editmyusercss" | "editmyuserjs" | "editmyuserjson" | "editmyuserjsredirect" | "editmywatchlist" | "editprotected" | "editsemiprotected" | "editsitecss" | "editsitejs" | "editsitejson" | "editusercss" | "edituserjs" | "edituserjson" | "extendedconfirmed" | "flow-create-board" | "flow-delete" | "flow-edit-post" | "flow-hide" | "flow-suppress" | "gadgets-definition-edit" | "gadgets-edit" | "globalblock" | "globalblock-exempt" | "globalblock-whitelist" | "globalgroupmembership" | "globalgrouppermissions" | "gwtoolset" | "hideuser" | "import" | "importupload" | "ipblock-exempt" | "manage-all-push-subscriptions" | "managechangetags" | "markbotedits" | "massmessage" | "mergehistory" | "minoredit" | "move" | "move-categorypages" | "move-rootuserpages" | "move-subpages" | "movefile" | "movestable" | "mwoauthmanageconsumer" | "mwoauthmanagemygrants" | "mwoauthproposeconsumer" | "mwoauthsuppress" | "mwoauthupdateownconsumer" | "mwoauthviewprivate" | "mwoauthviewsuppressed" | "newsletter-create" | "newsletter-delete" | "newsletter-manage" | "newsletter-restore" | "nominornewtalk" | "noratelimit" | "nuke" | "oathauth-api-all" | "oathauth-disable-for-user" | "oathauth-enable" | "oathauth-verify-user" | "oathauth-view-log" | "override-antispoof" | "override-export-depth" | "pagelang" | "pagetriage-copyvio" | "patrol" | "patrolmarks" | "protect" | "purge" | "read" | "renameuser" | "reupload" | "reupload-own" | "reupload-shared" | "review" | "rollback" | "securepoll-create-poll" | "sendemail" | "setmentor" | "siteadmin" | "skipcaptcha" | "spamblacklistlog" | "stablesettings" | "suppressionlog" | "suppressredirect" | "suppressrevision" | "tboverride" | "tboverride-account" | "templateeditor" | "titleblacklistlog" | "torunblocked" | "transcode-reset" | "transcode-status" | "unblockself" | "undelete" | "unreviewedpages" | "unwatchedpages" | "upload" | "upload_by_url" | "urlshortener-create-url" | "urlshortener-manage-url" | "urlshortener-view-log" | "usermerge" | "userrights" | "userrights-interwiki" | "validate" | "viewdeletedfile" | "viewmyprivateinfo" | "viewmywatchlist" | "viewsuppressed" | "vipsscaler-test" | "writeapi" */
    pcrights?: string;
    /** One or more of the following: "abusefilter-hidden-log" | "abusefilter-hide-log" | "abusefilter-log" | "abusefilter-log-detail" | "abusefilter-log-private" | "abusefilter-modify" | "abusefilter-modify-global" | "abusefilter-modify-restricted" | "abusefilter-privatedetails" | "abusefilter-privatedetails-log" | "abusefilter-revert" | "abusefilter-view" | "abusefilter-view-private" | "apihighlimits" | "applychangetags" | "autoconfirmed" | "autocreateaccount" | "autopatrol" | "autoreview" | "autoreviewrestore" | "bigdelete" | "block" | "blockemail" | "bot" | "browsearchive" | "centralauth-createlocal" | "centralauth-lock" | "centralauth-merge" | "centralauth-oversight" | "centralauth-rename" | "centralauth-unmerge" | "centralauth-usermerge" | "changetags" | "checkuser" | "checkuser-log" | "collectionsaveascommunitypage" | "collectionsaveasuserpage" | "createaccount" | "createpage" | "createpagemainns" | "createtalk" | "delete" | "delete-redirect" | "deletechangetags" | "deletedhistory" | "deletedtext" | "deletelogentry" | "deleterevision" | "edit" | "editautoreviewprotected" | "editcontentmodel" | "editeditorprotected" | "editextendedsemiprotected" | "editinterface" | "editmyoptions" | "editmyprivateinfo" | "editmyusercss" | "editmyuserjs" | "editmyuserjson" | "editmyuserjsredirect" | "editmywatchlist" | "editprotected" | "editsemiprotected" | "editsitecss" | "editsitejs" | "editsitejson" | "editusercss" | "edituserjs" | "edituserjson" | "extendedconfirmed" | "flow-create-board" | "flow-delete" | "flow-edit-post" | "flow-hide" | "flow-suppress" | "gadgets-definition-edit" | "gadgets-edit" | "globalblock" | "globalblock-exempt" | "globalblock-whitelist" | "globalgroupmembership" | "globalgrouppermissions" | "gwtoolset" | "hideuser" | "import" | "importupload" | "ipblock-exempt" | "manage-all-push-subscriptions" | "managechangetags" | "markbotedits" | "massmessage" | "mergehistory" | "minoredit" | "move" | "move-categorypages" | "move-rootuserpages" | "move-subpages" | "movefile" | "movestable" | "mwoauthmanageconsumer" | "mwoauthmanagemygrants" | "mwoauthproposeconsumer" | "mwoauthsuppress" | "mwoauthupdateownconsumer" | "mwoauthviewprivate" | "mwoauthviewsuppressed" | "newsletter-create" | "newsletter-delete" | "newsletter-manage" | "newsletter-restore" | "nominornewtalk" | "noratelimit" | "nuke" | "oathauth-api-all" | "oathauth-disable-for-user" | "oathauth-enable" | "oathauth-verify-user" | "oathauth-view-log" | "override-antispoof" | "override-export-depth" | "pagelang" | "pagetriage-copyvio" | "patrol" | "patrolmarks" | "protect" | "purge" | "read" | "renameuser" | "reupload" | "reupload-own" | "reupload-shared" | "review" | "rollback" | "securepoll-create-poll" | "sendemail" | "setmentor" | "siteadmin" | "skipcaptcha" | "spamblacklistlog" | "stablesettings" | "suppressionlog" | "suppressredirect" | "suppressrevision" | "tboverride" | "tboverride-account" | "templateeditor" | "titleblacklistlog" | "torunblocked" | "transcode-reset" | "transcode-status" | "unblockself" | "undelete" | "unreviewedpages" | "unwatchedpages" | "upload" | "upload_by_url" | "urlshortener-create-url" | "urlshortener-manage-url" | "urlshortener-view-log" | "usermerge" | "userrights" | "userrights-interwiki" | "validate" | "viewdeletedfile" | "viewmyprivateinfo" | "viewmywatchlist" | "viewsuppressed" | "vipsscaler-test" | "writeapi" */
    pcexcluderights?: string;
    pclimit?: limit;
    pccontinue?: string;
}

export interface GeoDataApiQueryCoordinatesParams extends ApiParamsQuery {
    colimit?: limit;
    cocontinue?: string;
    /** One or more of the following: "country" | "dim" | "globe" | "name" | "region" | "type" */
    coprop?: string;
    coprimary?: "all" | "primary" | "secondary";
    codistancefrompoint?: string;
    codistancefrompage?: string;
}

export interface ApiParamsQueryDeletedTranslations extends ApiParamsQuery {
    dtafter?: timestamp;
    dtnamespace?: namespace;
}

export interface ApiParamsQueryPublishedTranslations extends ApiParamsQuery {
    from?: string;
    to?: string;
    limit?: limit;
    offset?: string;
}

export interface ApiParamsQueryTranslatorStats extends ApiParamsQuery {
    translator?: string;
}

export interface ApiParamsQueryDeletedRevisions extends ApiParamsQuery {
    /** One or more of the following: "comment" | "content" | "contentmodel" | "flags" | "ids" | "parsedcomment" | "roles" | "sha1" | "size" | "slotsha1" | "slotsize" | "tags" | "timestamp" | "user" | "userid" | "parsetree" */
    drvprop?: string;
    /** One or more of the following: "main" */
    drvslots?: string;
    drvlimit?: limit;
    drvexpandtemplates?: boolean;
    drvgeneratexml?: boolean;
    drvparse?: boolean;
    drvsection?: string;
    drvdiffto?: string;
    drvdifftotext?: string;
    drvdifftotextpst?: boolean;
    drvcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    drvstart?: timestamp;
    drvend?: timestamp;
    drvdir?: "newer" | "older";
    drvtag?: string;
    drvuser?: string;
    drvexcludeuser?: string;
    drvcontinue?: string;
}

export interface ApiParamsQueryDeletedrevs extends ApiParamsQuery {
    drstart?: timestamp;
    drend?: timestamp;
    drdir?: "newer" | "older";
    drfrom?: string;
    drto?: string;
    drprefix?: string;
    drunique?: boolean;
    drnamespace?: namespace;
    drtag?: string;
    druser?: string;
    drexcludeuser?: string;
    /** One or more of the following: "comment" | "content" | "len" | "minor" | "parentid" | "parsedcomment" | "revid" | "sha1" | "tags" | "token" | "user" | "userid" */
    drprop?: string;
    drlimit?: limit;
    drcontinue?: string;
}

export interface WikibaseClientApiDescriptionParams extends ApiParamsQuery {
    desccontinue?: number;
    descprefersource?: "central" | "local";
}

export interface ApiParamsQueryDuplicateFiles extends ApiParamsQuery {
    dflimit?: limit;
    dfcontinue?: string;
    dfdir?: "ascending" | "descending";
    dflocalonly?: boolean;
}

export interface ApiParamsQueryBacklinks extends ApiParamsQuery {
    eititle?: string;
    eipageid?: number;
    eicontinue?: string;
    einamespace?: namespace | namespace[];
    eidir?: "ascending" | "descending";
    eifilterredir?: "all" | "nonredirects" | "redirects";
    eilimit?: limit;
}

export interface ApiParamsQueryExternalLinks extends ApiParamsQuery {
    ellimit?: limit;
    elcontinue?: string;
    elprotocol?:
        | ""
        | "bitcoin"
        | "ftp"
        | "ftps"
        | "geo"
        | "git"
        | "gopher"
        | "http"
        | "https"
        | "irc"
        | "ircs"
        | "magnet"
        | "mailto"
        | "mms"
        | "news"
        | "nntp"
        | "redis"
        | "sftp"
        | "sip"
        | "sips"
        | "sms"
        | "ssh"
        | "svn"
        | "tel"
        | "telnet"
        | "urn"
        | "worldwind"
        | "xmpp";
    elquery?: string;
    elexpandurl?: boolean;
}

export interface TextExtractsApiQueryExtractsParams extends ApiParamsQuery {
    exchars?: number;
    exsentences?: number;
    exlimit?: limit;
    exintro?: boolean;
    explaintext?: boolean;
    exsectionformat?: "plain" | "raw" | "wiki";
    excontinue?: number;
}

export interface ApiParamsQueryExtLinksUsage extends ApiParamsQuery {
    /** One or more of the following: "ids" | "title" | "url" */
    euprop?: string;
    eucontinue?: string;
    euprotocol?:
        | ""
        | "bitcoin"
        | "ftp"
        | "ftps"
        | "geo"
        | "git"
        | "gopher"
        | "http"
        | "https"
        | "irc"
        | "ircs"
        | "magnet"
        | "mailto"
        | "mms"
        | "news"
        | "nntp"
        | "redis"
        | "sftp"
        | "sip"
        | "sips"
        | "sms"
        | "ssh"
        | "svn"
        | "tel"
        | "telnet"
        | "urn"
        | "worldwind"
        | "xmpp";
    euquery?: string;
    eunamespace?: namespace | namespace[];
    eulimit?: limit;
    euexpandurl?: boolean;
}

export interface ApiParamsQueryFeatureUsage extends ApiParamsQuery {
    afustart?: timestamp;
    afuend?: timestamp;
    afuagent?: string;
    afufeatures?: string | string[];
}

export interface ApiParamsQueryFilearchive extends ApiParamsQuery {
    fafrom?: string;
    fato?: string;
    faprefix?: string;
    fadir?: "ascending" | "descending";
    fasha1?: string;
    fasha1base36?: string;
    /** One or more of the following: "archivename" | "bitdepth" | "description" | "dimensions" | "mediatype" | "metadata" | "mime" | "parseddescription" | "sha1" | "size" | "timestamp" | "user" */
    faprop?: string;
    falimit?: limit;
    facontinue?: string;
}

export interface ApiParamsQueryFileRepoInfo extends ApiParamsQuery {
    /** One or more of the following: "canUpload" | "descBaseUrl" | "descriptionCacheExpiry" | "displayname" | "favicon" | "fetchDescription" | "initialCapital" | "local" | "name" | "rootUrl" | "scriptDirUrl" | "thumbUrl" | "url" */
    friprop?: string;
}

export interface ApiParamsQueryBacklinksprop extends ApiParamsQuery {
    /** One or more of the following: "pageid" | "redirect" | "title" */
    fuprop?: string;
    funamespace?: namespace | namespace[];
    /** One or more of the following: "!redirect" | "redirect" */
    fushow?: string;
    fulimit?: limit;
    fucontinue?: string;
}

export interface ApiParamsQueryFlagged extends ApiParamsQuery {}

export interface ApiParamsQueryGadgetCategories extends ApiParamsQuery {
    /** One or more of the following: "members" | "name" | "title" */
    gcprop?: string;
    gcnames?: string | string[];
}

export interface ApiParamsQueryGadgets extends ApiParamsQuery {
    /** One or more of the following: "desc" | "id" | "metadata" */
    gaprop?: string;
    gacategories?: string | string[];
    gaids?: string | string[];
    gaallowedonly?: boolean;
    gaenabledonly?: boolean;
}

export interface GeoDataApiQueryGeoSearchElasticParams extends ApiParamsQuery {
    gscoord?: string;
    gspage?: string;
    gsbbox?: string;
    gsradius?: number;
    gsmaxdim?: number;
    gslimit?: limit;
    gsglobe?: "earth";
    gsnamespace?: namespace | namespace[];
    /** One or more of the following: "country" | "dim" | "globe" | "name" | "region" | "type" */
    gsprop?: string;
    gsprimary?: "all" | "primary" | "secondary";
    gsdebug?: boolean;
}

export interface GettingStartedApiGettingStartedGetPagesParams extends ApiParamsQuery {
    gsgptaskname?: string;
    gsgpexcludedtitle?: string;
    gsgpcount?: number;
}

export interface ApiParamsQueryGlobalAllUsers extends ApiParamsQuery {
    agufrom?: string;
    aguto?: string;
    aguprefix?: string;
    agudir?: "ascending" | "descending";
    /** One or more of the following: "abusefilter-helper" | "abusefilter-maintainer" | "apihighlimits-requestor" | "captcha-exempt" | "founder" | "global-bot" | "global-deleter" | "global-flow-create" | "global-interface-editor" | "global-ipblock-exempt" | "global-rollbacker" | "global-sysop" | "new-wikis-importer" | "oathauth-tester" | "ombuds" | "otrs-member" | "recursive-export" | "staff" | "steward" | "sysadmin" | "wmf-ops-monitoring" | "wmf-researcher" */
    agugroup?: string;
    /** One or more of the following: "abusefilter-helper" | "abusefilter-maintainer" | "apihighlimits-requestor" | "captcha-exempt" | "founder" | "global-bot" | "global-deleter" | "global-flow-create" | "global-interface-editor" | "global-ipblock-exempt" | "global-rollbacker" | "global-sysop" | "new-wikis-importer" | "oathauth-tester" | "ombuds" | "otrs-member" | "recursive-export" | "staff" | "steward" | "sysadmin" | "wmf-ops-monitoring" | "wmf-researcher" */
    aguexcludegroup?: string;
    /** One or more of the following: "existslocally" | "groups" | "lockinfo" */
    aguprop?: string;
    agulimit?: limit;
}

export interface ApiParamsQueryGlobalBlocks extends ApiParamsQuery {
    bgstart?: timestamp;
    bgend?: timestamp;
    bgdir?: "newer" | "older";
    bgids?: number | number[];
    bgaddresses?: string | string[];
    bgip?: string;
    bglimit?: limit;
    /** One or more of the following: "address" | "by" | "expiry" | "id" | "range" | "reason" | "timestamp" */
    bgprop?: string;
}

export interface ApiParamsQueryGlobalGroups extends ApiParamsQuery {
    /** One or more of the following: "rights" */
    ggpprop?: string;
}

export interface GlobalPreferencesApiQueryGlobalPreferencesParams extends ApiParamsQuery {
    /** One or more of the following: "localoverrides" | "preferences" */
    gprprop?: string;
}

export interface ApiParamsQueryGlobalRenameStatus extends ApiParamsQuery {
    grsuser?: string;
}

export interface ApiParamsQueryGlobalUsage extends ApiParamsQuery {
    /** One or more of the following: "namespace" | "pageid" | "url" */
    guprop?: string;
    gulimit?: limit;
    gunamespace?: namespace | namespace[];
    gusite?: string | string[];
    gucontinue?: string;
    gufilterlocal?: boolean;
}

export interface ApiParamsQueryGlobalUserInfo extends ApiParamsQuery {
    guiuser?: string;
    guiid?: number;
    /** One or more of the following: "editcount" | "groups" | "merged" | "rights" | "unattached" */
    guiprop?: string;
}

export interface ApiParamsQueryImageInfo extends ApiParamsQuery {
    /** One or more of the following: "archivename" | "badfile" | "bitdepth" | "canonicaltitle" | "comment" | "commonmetadata" | "dimensions" | "extmetadata" | "mediatype" | "metadata" | "mime" | "parsedcomment" | "sha1" | "size" | "thumbmime" | "timestamp" | "uploadwarning" | "url" | "user" | "userid" */
    iiprop?: string;
    iilimit?: limit;
    iistart?: timestamp;
    iiend?: timestamp;
    iiurlwidth?: number;
    iiurlheight?: number;
    iimetadataversion?: string;
    iiextmetadatalanguage?: string;
    iiextmetadatamultilang?: boolean;
    iiextmetadatafilter?: string | string[];
    iiurlparam?: string;
    iibadfilecontexttitle?: string;
    iicontinue?: string;
    iilocalonly?: boolean;
}

export interface ApiParamsQueryImages extends ApiParamsQuery {
    imlimit?: limit;
    imcontinue?: string;
    imimages?: string | string[];
    imdir?: "ascending" | "descending";
}

export interface ApiParamsQueryBacklinks extends ApiParamsQuery {
    iutitle?: string;
    iupageid?: number;
    iucontinue?: string;
    iunamespace?: namespace | namespace[];
    iudir?: "ascending" | "descending";
    iufilterredir?: "all" | "nonredirects" | "redirects";
    iulimit?: limit;
    iuredirect?: boolean;
}

export interface ApiParamsQueryInfo extends ApiParamsQuery {
    /** One or more of the following: "displaytitle" | "linkclasses" | "notificationtimestamp" | "preload" | "protection" | "subjectid" | "talkid" | "url" | "varianttitles" | "visitingwatchers" | "watched" | "watchers" | "readable" */
    inprop?: string;
    inlinkcontext?: string;
    intestactions?: string | string[];
    intestactionsdetail?: "boolean" | "full" | "quick";
    /** One or more of the following: "block" | "delete" | "edit" | "email" | "import" | "move" | "protect" | "unblock" | "watch" */
    intoken?: string;
    incontinue?: string;
}

export interface ApiParamsQueryIWBacklinks extends ApiParamsQuery {
    iwblprefix?: string;
    iwbltitle?: string;
    iwblcontinue?: string;
    iwbllimit?: limit;
    /** One or more of the following: "iwprefix" | "iwtitle" */
    iwblprop?: string;
    iwbldir?: "ascending" | "descending";
}

export interface ApiParamsQueryIWLinks extends ApiParamsQuery {
    /** One or more of the following: "url" */
    iwprop?: string;
    iwprefix?: string;
    iwtitle?: string;
    iwdir?: "ascending" | "descending";
    iwlimit?: limit;
    iwcontinue?: string;
    iwurl?: boolean;
}

export interface ApiParamsQueryLangBacklinks extends ApiParamsQuery {
    lbllang?: string;
    lbltitle?: string;
    lblcontinue?: string;
    lbllimit?: limit;
    /** One or more of the following: "lllang" | "lltitle" */
    lblprop?: string;
    lbldir?: "ascending" | "descending";
}

export interface ApiParamsQueryLangLinks extends ApiParamsQuery {
    /** One or more of the following: "autonym" | "langname" | "url" */
    llprop?: string;
    lllang?: string;
    lltitle?: string;
    lldir?: "ascending" | "descending";
    llinlanguagecode?: string;
    lllimit?: limit;
    llcontinue?: string;
    llurl?: boolean;
}

export interface ApiParamsQueryLangLinksCount extends ApiParamsQuery {}

export interface ApiParamsQueryLanguageinfo extends ApiParamsQuery {
    /** One or more of the following: "autonym" | "bcp47" | "code" | "dir" | "fallbacks" | "name" | "variants" */
    liprop?: string;
    licode?: string | string[];
    licontinue?: string;
}

export interface ApiParamsQueryLinks extends ApiParamsQuery {
    plnamespace?: namespace | namespace[];
    pllimit?: limit;
    plcontinue?: string;
    pltitles?: string | string[];
    pldir?: "ascending" | "descending";
}

export interface ApiParamsQueryBacklinksprop extends ApiParamsQuery {
    /** One or more of the following: "pageid" | "redirect" | "title" */
    lhprop?: string;
    lhnamespace?: namespace | namespace[];
    /** One or more of the following: "!redirect" | "redirect" */
    lhshow?: string;
    lhlimit?: limit;
    lhcontinue?: string;
}

export interface MediaWikiLinterApiQueryLintErrorsParams extends ApiParamsQuery {
    /** One or more of the following: "bogus-image-options" | "deletable-table-tag" | "fostered" | "html5-misnesting" | "misc-tidy-replacement-issues" | "misnested-tag" | "missing-end-tag" | "multi-colon-escape" | "multiline-html-table-in-list" | "multiple-unclosed-formatting-tags" | "obsolete-tag" | "pwrap-bug-workaround" | "self-closed-tag" | "stripped-tag" | "tidy-font-bug" | "tidy-whitespace-bug" | "unclosed-quotes-in-heading" | "wikilink-in-extlink" */
    lntcategories?: string;
    lntlimit?: limit;
    lntnamespace?: namespace | namespace[];
    lntpageid?: number | number[];
    lnttitle?: string;
    lntfrom?: number;
}

export interface MediaWikiLinterApiQueryLinterStatsParams extends ApiParamsQuery {}

export interface ApiParamsQueryLogEvents extends ApiParamsQuery {
    /** One or more of the following: "comment" | "details" | "ids" | "parsedcomment" | "tags" | "timestamp" | "title" | "type" | "user" | "userid" */
    leprop?: string;
    letype?:
        | ""
        | "abusefilter"
        | "abusefilterprivatedetails"
        | "block"
        | "contentmodel"
        | "create"
        | "delete"
        | "gblblock"
        | "gblrename"
        | "gblrights"
        | "globalauth"
        | "import"
        | "managetags"
        | "massmessage"
        | "merge"
        | "move"
        | "newusers"
        | "oath"
        | "pagetriage-copyvio"
        | "pagetriage-curation"
        | "pagetriage-deletion"
        | "patrol"
        | "protect"
        | "renameuser"
        | "review"
        | "rights"
        | "spamblacklist"
        | "stable"
        | "suppress"
        | "tag"
        | "thanks"
        | "timedmediahandler"
        | "titleblacklist"
        | "upload"
        | "urlshortener"
        | "usermerge";
    leaction?:
        | "abusefilter/create"
        | "abusefilter/hit"
        | "abusefilter/modify"
        | "abusefilterprivatedetails/access"
        | "block/block"
        | "block/reblock"
        | "block/unblock"
        | "contentmodel/change"
        | "contentmodel/new"
        | "create/create"
        | "delete/delete"
        | "delete/delete_redir"
        | "delete/delete_redir2"
        | "delete/event"
        | "delete/restore"
        | "delete/revision"
        | "gblblock/dwhitelist"
        | "gblblock/gblock"
        | "gblblock/gblock2"
        | "gblblock/gunblock"
        | "gblblock/modify"
        | "gblblock/whitelist"
        | "gblrename/merge"
        | "gblrename/promote"
        | "gblrename/rename"
        | "gblrights/deleteset"
        | "gblrights/groupperms"
        | "gblrights/groupprms2"
        | "gblrights/groupprms3"
        | "gblrights/grouprename"
        | "gblrights/newset"
        | "gblrights/setchange"
        | "gblrights/setnewtype"
        | "gblrights/setrename"
        | "gblrights/usergroups"
        | "globalauth/delete"
        | "globalauth/hide"
        | "globalauth/lock"
        | "globalauth/lockandhid"
        | "globalauth/setstatus"
        | "globalauth/unhide"
        | "globalauth/unlock"
        | "import/interwiki"
        | "import/upload"
        | "interwiki/*"
        | "managetags/activate"
        | "managetags/create"
        | "managetags/deactivate"
        | "managetags/delete"
        | "massmessage/*"
        | "massmessage/failure"
        | "massmessage/send"
        | "massmessage/skipbadns"
        | "massmessage/skipnouser"
        | "massmessage/skipoptout"
        | "merge/merge"
        | "move/move"
        | "move/move_redir"
        | "newusers/autocreate"
        | "newusers/byemail"
        | "newusers/create"
        | "newusers/create2"
        | "newusers/forcecreatelocal"
        | "newusers/newusers"
        | "oath/*"
        | "pagetriage-copyvio/insert"
        | "pagetriage-curation/delete"
        | "pagetriage-curation/enqueue"
        | "pagetriage-curation/reviewed"
        | "pagetriage-curation/tag"
        | "pagetriage-curation/unreviewed"
        | "pagetriage-deletion/delete"
        | "patrol/autopatrol"
        | "patrol/patrol"
        | "protect/modify"
        | "protect/move_prot"
        | "protect/protect"
        | "protect/unprotect"
        | "renameuser/renameuser"
        | "review/approve"
        | "review/approve-a"
        | "review/approve-i"
        | "review/approve-ia"
        | "review/approve2"
        | "review/approve2-a"
        | "review/approve2-i"
        | "review/approve2-ia"
        | "review/unapprove"
        | "review/unapprove2"
        | "rights/autopromote"
        | "rights/blockautopromote"
        | "rights/erevoke"
        | "rights/restoreautopromote"
        | "rights/rights"
        | "spamblacklist/*"
        | "stable/config"
        | "stable/modify"
        | "stable/move_stable"
        | "stable/reset"
        | "suppress/block"
        | "suppress/cadelete"
        | "suppress/delete"
        | "suppress/event"
        | "suppress/hide-afl"
        | "suppress/reblock"
        | "suppress/revision"
        | "suppress/setstatus"
        | "suppress/unhide-afl"
        | "tag/update"
        | "thanks/*"
        | "timedmediahandler/resettranscode"
        | "titleblacklist/*"
        | "upload/overwrite"
        | "upload/revert"
        | "upload/upload"
        | "urlshortener/*"
        | "usermerge/*";
    lestart?: timestamp;
    leend?: timestamp;
    ledir?: "newer" | "older";
    leuser?: string;
    letitle?: string;
    lenamespace?: namespace;
    leprefix?: string;
    letag?: string;
    lelimit?: limit;
    lecontinue?: string;
}

export interface KartographerApiQueryMapDataParams extends ApiParamsQuery {
    mpdgroups?: string;
    mpdlimit?: limit;
    mpdcontinue?: number;
}

export interface MediaWikiMassMessageApiQueryMMSitesParams extends ApiParamsQuery {
    term?: string;
}

export interface PageViewInfoApiQueryMostViewedParams extends ApiParamsQuery {
    pvimmetric?: "pageviews";
    pvimlimit?: limit;
    pvimoffset?: number;
}

export interface ApiParamsQueryMyStashedFiles extends ApiParamsQuery {
    /** One or more of the following: "size" | "type" */
    msfprop?: string;
    msflimit?: limit;
    msfcontinue?: string;
}

export interface ApiParamsEchoNotifications extends ApiParamsQuery {
    notwikis?: string | string[];
    /** One or more of the following: "!read" | "read" */
    notfilter?: string;
    /** One or more of the following: "count" | "list" | "seenTime" */
    notprop?: string;
    /** One or more of the following: "alert" | "message" */
    notsections?: string;
    notgroupbysection?: boolean;
    notformat?: "flyout" | "html" | "model" | "special";
    notlimit?: limit;
    notcontinue?: string;
    notunreadfirst?: boolean;
    nottitles?: string | string[];
    notbundle?: boolean;
    notalertcontinue?: string;
    notalertunreadfirst?: boolean;
    notmessagecontinue?: string;
    notmessageunreadfirst?: boolean;
    notcrosswikisummary?: boolean;
}

export interface OATHAuthApiModuleApiQueryOATHParams extends ApiParamsQuery {
    oathuser?: string;
    oathreason?: string;
}

export interface ApiParamsQueryOldreviewedpages extends ApiParamsQuery {
    orstart?: timestamp;
    orend?: timestamp;
    ordir?: "newer" | "older";
    ormaxsize?: number;
    orfilterwatched?: "all" | "watched";
    ornamespace?: namespace | namespace[];
    orcategory?: string;
    orfilterredir?: "all" | "nonredirects" | "redirects";
    orlimit?: limit;
}

export interface ORESHooksApiQueryORESParams extends ApiParamsQuery {}

export interface PageAssessmentsApiQueryPageAssessmentsParams extends ApiParamsQuery {
    pacontinue?: string;
    palimit?: limit;
    pasubprojects?: boolean;
}

export interface PageImagesApiQueryPageImagesParams extends ApiParamsQuery {
    /** One or more of the following: "name" | "original" | "thumbnail" */
    piprop?: string;
    pithumbsize?: number;
    pilimit?: limit;
    pilicense?: "any" | "free";
    picontinue?: number;
    pilangcode?: string;
}

export interface ApiParamsQueryPagePropNames extends ApiParamsQuery {
    ppncontinue?: string;
    ppnlimit?: limit;
}

export interface ApiParamsQueryPageProps extends ApiParamsQuery {
    ppcontinue?: string;
    ppprop?: string | string[];
}

export interface ApiParamsQueryPagesWithProp extends ApiParamsQuery {
    pwppropname?: string;
    /** One or more of the following: "ids" | "title" | "value" */
    pwpprop?: string;
    pwpcontinue?: string;
    pwplimit?: limit;
    pwpdir?: "ascending" | "descending";
}

export interface WikibaseClientApiPageTermsParams extends ApiParamsQuery {
    wbptcontinue?: number;
    /** One or more of the following: "alias" | "description" | "label" */
    wbptterms?: string;
}

export interface PageViewInfoApiQueryPageViewsParams extends ApiParamsQuery {
    pvipmetric?: "pageviews";
    pvipdays?: number;
    pvipcontinue?: string;
}

export interface ApiParamsQueryPrefixSearch extends ApiParamsQuery {
    pssearch?: string;
    psnamespace?: namespace | namespace[];
    pslimit?: limit;
    psoffset?: number;
    psprofile?: "classic" | "engine_autoselect" | "fast-fuzzy" | "fuzzy" | "normal" | "strict";
}

export interface PageAssessmentsApiQueryProjectPagesParams extends ApiParamsQuery {
    wppassessments?: boolean;
    wppprojects?: string | string[];
    wpplimit?: limit;
    wppcontinue?: string;
}

export interface PageAssessmentsApiQueryProjectsParams extends ApiParamsQuery {
    pjsubprojects?: boolean;
}

export interface ApiParamsQueryProtectedTitles extends ApiParamsQuery {
    ptnamespace?: namespace | namespace[];
    /** One or more of the following: "autoconfirmed" | "extendedconfirmed" | "sysop" | "templateeditor" */
    ptlevel?: string;
    ptlimit?: limit;
    ptdir?: "newer" | "older";
    ptstart?: timestamp;
    ptend?: timestamp;
    /** One or more of the following: "comment" | "expiry" | "level" | "parsedcomment" | "timestamp" | "user" | "userid" */
    ptprop?: string;
    ptcontinue?: string;
}

export interface ApiParamsQueryQueryPage extends ApiParamsQuery {
    qppage?:
        | "Ancientpages"
        | "BrokenRedirects"
        | "Deadendpages"
        | "DisambiguationPageLinks"
        | "DisambiguationPages"
        | "DoubleRedirects"
        | "Fewestrevisions"
        | "GadgetUsage"
        | "GloballyWantedFiles"
        | "ListDuplicatedFiles"
        | "Listredirects"
        | "Lonelypages"
        | "Longpages"
        | "MediaStatistics"
        | "MostGloballyLinkedFiles"
        | "Mostcategories"
        | "Mostimages"
        | "Mostinterwikis"
        | "Mostlinked"
        | "Mostlinkedcategories"
        | "Mostlinkedtemplates"
        | "Mostrevisions"
        | "Shortpages"
        | "Uncategorizedcategories"
        | "Uncategorizedimages"
        | "Uncategorizedpages"
        | "Uncategorizedtemplates"
        | "UnconnectedPages"
        | "Unusedcategories"
        | "Unusedimages"
        | "Unusedtemplates"
        | "Unwatchedpages"
        | "Wantedcategories"
        | "Wantedfiles"
        | "Wantedpages"
        | "Wantedtemplates"
        | "Withoutinterwiki";
    qpoffset?: number;
    qplimit?: limit;
}

export interface ApiParamsQueryRandom extends ApiParamsQuery {
    rnnamespace?: namespace | namespace[];
    rnfilterredir?: "all" | "nonredirects" | "redirects";
    rnredirect?: boolean;
    rnlimit?: limit;
    rncontinue?: string;
}

export interface ReadingListsApiQueryReadingListEntriesParams extends ApiParamsQuery {
    rlelists?: number | number[];
    rlechangedsince?: timestamp;
    rlesort?: "name" | "updated";
    rledir?: "ascending" | "descending";
    rlelimit?: limit;
    rlecontinue?: string;
}

export interface ReadingListsApiQueryReadingListsParams extends ApiParamsQuery {
    rllist?: number;
    rlproject?: string;
    rltitle?: string;
    rlchangedsince?: timestamp;
    rlsort?: "name" | "updated";
    rldir?: "ascending" | "descending";
    rllimit?: limit;
    rlcontinue?: string;
}

export interface ApiParamsQueryRecentChanges extends ApiParamsQuery {
    rcstart?: timestamp;
    rcend?: timestamp;
    rcdir?: "newer" | "older";
    rcnamespace?: namespace | namespace[];
    rcuser?: string;
    rcexcludeuser?: string;
    rctag?: string;
    /** One or more of the following: "comment" | "flags" | "ids" | "loginfo" | "oresscores" | "parsedcomment" | "patrolled" | "redirect" | "sha1" | "sizes" | "tags" | "timestamp" | "title" | "user" | "userid" */
    rcprop?: string;
    /** One or more of the following: "patrol" */
    rctoken?: string;
    /** One or more of the following: "!anon" | "!autopatrolled" | "!bot" | "!minor" | "!oresreview" | "!patrolled" | "!redirect" | "anon" | "autopatrolled" | "bot" | "minor" | "oresreview" | "patrolled" | "redirect" | "unpatrolled" */
    rcshow?: string;
    rclimit?: limit;
    /** One or more of the following: "categorize" | "edit" | "external" | "log" | "new" */
    rctype?: string;
    rctoponly?: boolean;
    rctitle?: string;
    rccontinue?: string;
    rcgeneraterevisions?: boolean;
    rcslot?: "main";
}

export interface ApiParamsQueryBacklinksprop extends ApiParamsQuery {
    /** One or more of the following: "fragment" | "pageid" | "title" */
    rdprop?: string;
    rdnamespace?: namespace | namespace[];
    /** One or more of the following: "!fragment" | "fragment" */
    rdshow?: string;
    rdlimit?: limit;
    rdcontinue?: string;
}

export interface ApiParamsQueryRevisions extends ApiParamsQuery {
    /** One or more of the following: "comment" | "content" | "contentmodel" | "flagged" | "flags" | "ids" | "oresscores" | "parsedcomment" | "roles" | "sha1" | "size" | "slotsha1" | "slotsize" | "tags" | "timestamp" | "user" | "userid" | "parsetree" */
    rvprop?: string;
    /** One or more of the following: "main" */
    rvslots?: string;
    rvlimit?: limit;
    rvexpandtemplates?: boolean;
    rvgeneratexml?: boolean;
    rvparse?: boolean;
    rvsection?: string;
    rvdiffto?: string;
    rvdifftotext?: string;
    rvdifftotextpst?: boolean;
    rvcontentformat?:
        | "application/json"
        | "application/octet-stream"
        | "application/unknown"
        | "application/x-binary"
        | "text/css"
        | "text/javascript"
        | "text/plain"
        | "text/unknown"
        | "text/x-wiki"
        | "unknown/unknown";
    rvstartid?: number;
    rvendid?: number;
    rvstart?: timestamp;
    rvend?: timestamp;
    rvdir?: "newer" | "older";
    rvuser?: string;
    rvexcludeuser?: string;
    rvtag?: string;
    /** One or more of the following: "rollback" */
    rvtoken?: string;
    rvcontinue?: string;
}

export interface ApiParamsQuerySearch extends ApiParamsQuery {
    srsearch?: string;
    srnamespace?: namespace | namespace[];
    srlimit?: limit;
    sroffset?: number;
    srqiprofile?:
        | "classic"
        | "classic_noboostlinks"
        | "empty"
        | "engine_autoselect"
        | "mlr-1024rs"
        | "popular_inclinks"
        | "popular_inclinks_pv"
        | "wsum_inclinks"
        | "wsum_inclinks_pv";
    srwhat?: "nearmatch" | "text" | "title";
    /** One or more of the following: "rewrittenquery" | "suggestion" | "totalhits" */
    srinfo?: string;
    /** One or more of the following: "categorysnippet" | "extensiondata" | "isfilematch" | "redirectsnippet" | "redirecttitle" | "sectionsnippet" | "sectiontitle" | "size" | "snippet" | "timestamp" | "titlesnippet" | "wordcount" | "hasrelated" | "score" */
    srprop?: string;
    srinterwiki?: boolean;
    srenablerewrites?: boolean;
    srsort?:
        | "create_timestamp_asc"
        | "create_timestamp_desc"
        | "incoming_links_asc"
        | "incoming_links_desc"
        | "just_match"
        | "last_edit_asc"
        | "last_edit_desc"
        | "none"
        | "random"
        | "relevance";
}

export interface ApiParamsQuerySiteinfo extends ApiParamsQuery {
    /** One or more of the following: "dbrepllag" | "defaultoptions" | "extensions" | "extensiontags" | "fileextensions" | "functionhooks" | "general" | "interwikimap" | "languages" | "languagevariants" | "libraries" | "magicwords" | "namespacealiases" | "namespaces" | "protocols" | "restrictions" | "rightsinfo" | "showhooks" | "skins" | "specialpagealiases" | "statistics" | "uploaddialog" | "usergroups" | "variables" */
    siprop?: string;
    sifilteriw?: "!local" | "local";
    sishowalldb?: boolean;
    sinumberingroup?: boolean;
    siinlanguagecode?: string;
}

export interface PageViewInfoApiQuerySiteViewsParams extends ApiParamsQuery {
    pvismetric?: "pageviews" | "uniques";
    pvisdays?: number;
}

export interface ApiParamsQueryStashImageInfo extends ApiParamsQuery {
    siifilekey?: string | string[];
    siisessionkey?: string | string[];
    /** One or more of the following: "badfile" | "bitdepth" | "canonicaltitle" | "commonmetadata" | "dimensions" | "extmetadata" | "metadata" | "mime" | "sha1" | "size" | "thumbmime" | "timestamp" | "url" */
    siiprop?: string;
    siiurlwidth?: number;
    siiurlheight?: number;
    siiurlparam?: string;
}

export interface ApiParamsQueryTags extends ApiParamsQuery {
    tgcontinue?: string;
    tglimit?: limit;
    /** One or more of the following: "active" | "defined" | "description" | "displayname" | "hitcount" | "source" */
    tgprop?: string;
}

export interface ApiParamsQueryLinks extends ApiParamsQuery {
    tlnamespace?: namespace | namespace[];
    tllimit?: limit;
    tlcontinue?: string;
    tltemplates?: string | string[];
    tldir?: "ascending" | "descending";
}

export interface ApiParamsQueryTokens extends ApiParamsQuery {
    /** One or more of the following: "createaccount" | "csrf" | "deleteglobalaccount" | "login" | "patrol" | "rollback" | "setglobalaccountstatus" | "userrights" | "watch" */
    type?: string;
}

export interface ApiParamsQueryBacklinksprop extends ApiParamsQuery {
    /** One or more of the following: "pageid" | "redirect" | "title" */
    tiprop?: string;
    tinamespace?: namespace | namespace[];
    /** One or more of the following: "!redirect" | "redirect" */
    tishow?: string;
    tilimit?: limit;
    ticontinue?: string;
}

export interface ApiParamsTranscodeStatus extends ApiParamsQuery {}

export interface ApiParamsEchoUnreadNotificationPages extends ApiParamsQuery {
    unpwikis?: string | string[];
    unpgrouppages?: boolean;
    unplimit?: limit;
}

export interface ApiParamsQueryUserContribs extends ApiParamsQuery {
    uclimit?: limit;
    ucstart?: timestamp;
    ucend?: timestamp;
    uccontinue?: string;
    ucuser?: string | string[];
    ucuserids?: number | number[];
    ucuserprefix?: string;
    ucdir?: "newer" | "older";
    ucnamespace?: namespace | namespace[];
    /** One or more of the following: "comment" | "flags" | "ids" | "oresscores" | "parsedcomment" | "patrolled" | "size" | "sizediff" | "tags" | "timestamp" | "title" */
    ucprop?: string;
    /** One or more of the following: "!autopatrolled" | "!minor" | "!new" | "!oresreview" | "!patrolled" | "!top" | "autopatrolled" | "minor" | "new" | "oresreview" | "patrolled" | "top" */
    ucshow?: string;
    uctag?: string;
    uctoponly?: boolean;
}

export interface ApiParamsQueryUserInfo extends ApiParamsQuery {
    /** One or more of the following: "acceptlang" | "blockinfo" | "centralids" | "changeablegroups" | "editcount" | "email" | "groupmemberships" | "groups" | "hasmsg" | "implicitgroups" | "latestcontrib" | "options" | "ratelimits" | "realname" | "registrationdate" | "rights" | "theoreticalratelimits" | "unreadcount" | "preferencestoken" */
    uiprop?: string;
    uiattachedwiki?: string;
}

export interface ApiParamsQueryUsers extends ApiParamsQuery {
    /** One or more of the following: "blockinfo" | "cancreate" | "centralids" | "editcount" | "emailable" | "gender" | "groupmemberships" | "groups" | "implicitgroups" | "registration" | "rights" */
    usprop?: string;
    usattachedwiki?: string;
    ususers?: string | string[];
    ususerids?: number | number[];
    /** One or more of the following: "userrights" */
    ustoken?: string;
}

export interface ApiParamsQueryVideoInfo extends ApiParamsQuery {
    /** One or more of the following: "archivename" | "badfile" | "bitdepth" | "canonicaltitle" | "comment" | "commonmetadata" | "derivatives" | "dimensions" | "extmetadata" | "mediatype" | "metadata" | "mime" | "parsedcomment" | "sha1" | "size" | "thumbmime" | "timedtext" | "timestamp" | "uploadwarning" | "url" | "user" | "userid" */
    viprop?: string;
    vilimit?: limit;
    vistart?: timestamp;
    viend?: timestamp;
    viurlwidth?: number;
    viurlheight?: number;
    vimetadataversion?: string;
    viextmetadatalanguage?: string;
    viextmetadatamultilang?: boolean;
    viextmetadatafilter?: string | string[];
    viurlparam?: string;
    vibadfilecontexttitle?: string;
    vicontinue?: string;
    vilocalonly?: string;
}

export interface ApiParamsQueryWatchlist extends ApiParamsQuery {
    wlallrev?: boolean;
    wlstart?: timestamp;
    wlend?: timestamp;
    wlnamespace?: namespace | namespace[];
    wluser?: string;
    wlexcludeuser?: string;
    wldir?: "newer" | "older";
    wllimit?: limit;
    /** One or more of the following: "comment" | "expiry" | "flags" | "ids" | "loginfo" | "notificationtimestamp" | "oresscores" | "parsedcomment" | "patrol" | "sizes" | "tags" | "timestamp" | "title" | "user" | "userid" */
    wlprop?: string;
    /** One or more of the following: "!anon" | "!autopatrolled" | "!bot" | "!minor" | "!oresreview" | "!patrolled" | "!unread" | "anon" | "autopatrolled" | "bot" | "minor" | "oresreview" | "patrolled" | "unread" */
    wlshow?: string;
    /** One or more of the following: "categorize" | "edit" | "external" | "log" | "new" */
    wltype?: string;
    wlowner?: string;
    wltoken?: string;
    wlcontinue?: string;
}

export interface ApiParamsQueryWatchlistRaw extends ApiParamsQuery {
    wrcontinue?: string;
    wrnamespace?: namespace | namespace[];
    wrlimit?: limit;
    /** One or more of the following: "changed" */
    wrprop?: string;
    /** One or more of the following: "!changed" | "changed" */
    wrshow?: string;
    wrowner?: string;
    wrtoken?: string;
    wrdir?: "ascending" | "descending";
    wrfromtitle?: string;
    wrtotitle?: string;
}

export interface WikibaseClientApiPropsEntityUsageParams extends ApiParamsQuery {
    /** One or more of the following: "url" */
    wbeuprop?: string;
    /** One or more of the following: "C" | "D" | "L" | "O" | "S" | "T" | "X" */
    wbeuaspect?: string;
    wbeuentities?: string | string[];
    wbeulimit?: limit;
    wbeucontinue?: string;
}

export interface WikibaseClientApiListEntityUsageParams extends ApiParamsQuery {
    /** One or more of the following: "url" */
    wbeuprop?: string;
    /** One or more of the following: "C" | "D" | "L" | "O" | "S" | "T" | "X" */
    wbeuaspect?: string;
    wbeuentities?: string | string[];
    wbeulimit?: limit;
    wbeucontinue?: string;
}

export interface WikibaseClientApiClientInfoParams extends ApiParamsQuery {
    /** One or more of the following: "siteid" | "url" */
    wbprop?: string;
}

export interface ApiParamsQueryWikiSets extends ApiParamsQuery {
    wsfrom?: string;
    /** One or more of the following: "type" | "wikisincluded" | "wikisnotincluded" */
    wsprop?: string;
    wslimit?: limit;
    wsorderbyname?: boolean;
}
