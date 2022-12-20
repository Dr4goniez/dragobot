export interface DynamicObject {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
}

// ******************* General API responses *******************
export interface ApiResponse {
    // General properties
    warnings?: {
        [key: string]: {
            warnings: string
        }
    },
    batchcomplete?: boolean,
    requestid?: string,
    servedby?: string,
    curtimestamp?: string,
    uselang?: string,
    errorlang?: string,
    limits?: {
        [key: string]: number
    },
    error?: ApiResponseError,
    continue?: {
        [key: string]: string
    },
    normalized?: ApiResponseNormalized[],
    // Action-specific properties
    edit?: ApiResponseEdit,
    login?: ApiResponseLogin,
    purge?: ApiResponsePurge[],
    query?: ApiResponseQuery
}
export interface ApiResponseError {
    code: string,
    info: string,
    docref: string
}
export interface ApiResponseNormalized {
    fromencoded?: boolean,
    from: string,
    to: string
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
    result: string,
    pageid: number,
    title: string,
    contentmodel: string,
    oldrevid: number,
    newrevid: number,
    newtimestamp: string
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
    lguserid?: number,
    result: string,
    lgusername: string,
    lgtoken?: string
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
    ns: number,
    title: string,
    missing?: boolean,
    purged?: boolean
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
    normalized?: ApiResponseNormalized[],
    pageids?: string[],
    pages?: ApiResponseQueryPages[],
    // abusefilters?: ApiResponseQueryListAbusefilters,
    // abuselog?: ApiResponseQueryListAbuselog,
    // allcategories?: ApiResponseQueryListAllcategories,
    // alldeletedrevisions?: ApiResponseQueryListAlldeletedrevisions,
    // allfileusages?: ApiResponseQueryListAllfileusages,
    // allimages?: ApiResponseQueryListAllimages,
    // alllinks?: ApiResponseQueryListAlllinks,
    // allpages?: ApiResponseQueryListAllpages,
    // allredirects?: ApiResponseQueryListAllredirects,
    // allrevisions?: ApiResponseQueryListAllrevisions,
    // alltransclusions?: ApiResponseQueryListAlltransclusions,
    // allusers?: ApiResponseQueryListAllusers,
    betafeatures?: ApiResponseQueryListBetafeatures,
    backlinks?: ApiResponseQueryListBacklinks[],
    // blocks?: ApiResponseQueryListBlocks,
    categorymembers?: ApiResponseQueryListCategorymembers[],
    // centralnoticeactivecampaigns?: ApiResponseQueryListCentralnoticeactivecampaigns,
    // centralnoticelogs?: ApiResponseQueryListCentralnoticelogs,
    // checkuser?: ApiResponseQueryListCheckuser,
    // checkuserlog?: ApiResponseQueryListCheckuserlog,
    embeddedin?: ApiResponseQueryListEmbeddedin[],
    // extdistrepos?: ApiResponseQueryListExtdistrepos,
    // exturlusage?: ApiResponseQueryListExturlusage,
    // filearchive?: ApiResponseQueryListFilearchive,
    // gadgetcategories?: ApiResponseQueryListGadgetcategories,
    // gadgets?: ApiResponseQueryListGadgets,
    // globalallusers?: ApiResponseQueryListGlobalallusers,
    // globalblocks?: ApiResponseQueryListGlobalblocks,
    // globalgroups?: ApiResponseQueryListGlobalgroups,
    // imageusage?: ApiResponseQueryListImageusage,
    // iwbacklinks?: ApiResponseQueryListIwbacklinks,
    // langbacklinks?: ApiResponseQueryListLangbacklinks,
    // linterrors?: ApiResponseQueryListLinterrors,
    // logevents?: ApiResponseQueryListLogevents,
    // messagecollection?: ApiResponseQueryListMessagecollection,
    // mostviewed?: ApiResponseQueryListMostviewed,
    // mystashedfiles?: ApiResponseQueryListMystashedfiles,
    // pagepropnames?: ApiResponseQueryListPagepropnames,
    // pageswithprop?: ApiResponseQueryListPageswithprop,
    // prefixsearch?: ApiResponseQueryListPrefixsearch,
    // protectedtitles?: ApiResponseQueryListProtectedtitles,
    // querypage?: ApiResponseQueryListQuerypage,
    // random?: ApiResponseQueryListRandom,
    // recentchanges?: ApiResponseQueryListRecentchanges,
    // search?: ApiResponseQueryListSearch,
    // tags?: ApiResponseQueryListTags,
    // threads?: ApiResponseQueryListThreads,
    // usercontribs?: ApiResponseQueryListUsercontribs,
    // users?: ApiResponseQueryListUsers,
    // watchlist?: ApiResponseQueryListWatchlist,
    // watchlistraw?: ApiResponseQueryListWatchlistraw,
    // wblistentityusage?: ApiResponseQueryListWblistentityusage,
    // wikisets?: ApiResponseQueryListWikisets,
}
export interface ApiResponseQueryPages {
    pageid?: number,
    ns: number,
    title: string,
    missing?: boolean,
    revisions?: ApiResponseQueryPagesRevisions[],
    contentmodel?: string,
    pagelanguage?: string,
    pagelanguagehtmlcode?: string,
    pagelanguagedir?: string,
    touched?: string,
    lastrevid?: number,
    length?: number,
    redirect?: boolean,
    protection?: ApiResponseQueryPagesProtection[],
    restrictiontypes?: string[],
    watched?: boolean,
    watchers?: number,
    visitingwatchers?: number,
    notificationtimestamp?: string,
    talkid?: number,
    associatedpage?: string,
    fullurl?: string,
    editurl?: string,
    canonicalurl?: string,
    readable?: boolean,
    preload?: string,
    displaytitle?: string,
    varianttitles?: {
        [key: string]: string
    },
    linkclasses?: any[]
}
export interface ApiResponseQueryPagesRevisions {
    revid: number,
    parentid: number,
    minor: boolean,
    user: string,
    userid: number,
    timestamp: string,
    size: number,
    sha1: string,
    roles: string[],
    slots: {
        [key: string]: {
            size: number,
            sha1: string,
            contentmodel: string,
            contentformat: string,
            content: string
        }
    },
    comment: string,
    parsedcomment: string,
    tags: string[],
}
export interface ApiResponseQueryPagesProtection {
    type: string,
    level: string,
    expiry: string
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
    pageid: number,
    ns: number,
    title: string
}
export interface ApiResponseQueryListBetafeatures {
    [key: string]: {
        name: string,
        count: number
    }
}
// export interface ApiResponseQueryListBlocks {}
export interface ApiResponseQueryListCategorymembers {
    pageid: number,
    ns: number,
    title: string,
    sortkey?: string,
    sortkeyprefix?: string,
    type?: string,
    timestamp?: string
}
// export interface ApiResponseQueryListCentralnoticeactivecampaigns {}
// export interface ApiResponseQueryListCentralnoticelogs {}
// export interface ApiResponseQueryListCheckuser {}
// export interface ApiResponseQueryListCheckuserlog {}
export interface ApiResponseQueryListEmbeddedin {
    pageid: number
    ns: number,
    title: string
}
// export interface ApiResponseQueryListExtdistrepos {}
// export interface ApiResponseQueryListExturlusage {}
// export interface ApiResponseQueryListFilearchive {}
// export interface ApiResponseQueryListGadgetcategories {}
// export interface ApiResponseQueryListGadgets {}
// export interface ApiResponseQueryListGlobalallusers {}
// export interface ApiResponseQueryListGlobalblocks {}
// export interface ApiResponseQueryListGlobalgroups {}
// export interface ApiResponseQueryListImageusage {}
// export interface ApiResponseQueryListIwbacklinks {}
// export interface ApiResponseQueryListLangbacklinks {}
// export interface ApiResponseQueryListLinterrors {}
// export interface ApiResponseQueryListLogevents {}
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
// export interface ApiResponseQueryListSearch {}
// export interface ApiResponseQueryListTags {}
// export interface ApiResponseQueryListThreads {}
// export interface ApiResponseQueryListUsercontribs {}
// export interface ApiResponseQueryListUsers {}
// export interface ApiResponseQueryListWatchlist {}
// export interface ApiResponseQueryListWatchlistraw {}
// export interface ApiResponseQueryListWblistentityusage {}
// export interface ApiResponseQueryListWikisets {}