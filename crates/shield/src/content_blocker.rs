//! The shield's rules as a WebKit content blocker list, for Linux: WebKitGTK asks no one before a request, so it gets
//! the rules up front. The same lists as the engine's, network rules only, as the app blocks on Windows.

use crate::rules_text;
use adblock::content_blocking::{CbAction, CbRule, CbTrigger, CbType};
use adblock::lists::{FilterSet, ParseOptions, RuleTypes};
use anyhow::{Result, anyhow};
use serde_json::Value;
use std::fmt::Write;
use std::hash::{DefaultHasher, Hash, Hasher};

/// WebKit refuses a longer list whole.
const MAX_RULES: usize = 150_000;

/// The app's own addresses and what is no web request: `Shield::should_block` only judges what starts with `http`.
const NEVER_BLOCKED: [&str; 7] = ["^tauri:", "^ipc:", "^asset:", "^art:", "^data:", "^blob:", "^wss?:"];

/// `lists` as `Shield::new` takes them, in the JSON WebKit's content filter store compiles.
pub fn content_blocker(lists: &str) -> Result<String> {
    // Debug: the converter works from each rule's own line.
    let mut filters = FilterSet::new(true);
    filters.add_filter_list(rules_text(lists), ParseOptions { rule_types: RuleTypes::NetworkOnly, ..Default::default() });
    let (mut rules, _) = filters.into_content_blocking().map_err(|()| anyhow!("The filter lists can't be converted"))?;
    // A rule for kinds WebKit has no name for (`$document` alone) comes out with none, which WebKit reads as every kind.
    rules.retain(|rule| rule.trigger.resource_type.as_ref().is_none_or(|kinds| !kinds.is_empty()));
    let mut rules = within(rules, MAX_RULES - NEVER_BLOCKED.len());
    // Last, so they undo whatever matched before.
    rules.extend(NEVER_BLOCKED.map(never_block));
    written(rules)
}

/// What a converted list's compiled copy is filed under: another text, another key.
pub fn content_blocker_key(json: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    json.hash(&mut hasher);
    hasher.finish()
}

/// The converter holds a rule's kinds in a set, which comes out in a new order each time: sorted, so that the same
/// rules always give the same text, and key. One rule at a time: the whole list as JSON values would take a small
/// machine's memory at every launch.
fn written(rules: Vec<CbRule>) -> Result<String> {
    let mut list = String::from("[");
    for (index, rule) in rules.into_iter().enumerate() {
        let mut rule = serde_json::to_value(rule)?;
        if let Some(Value::Array(kinds)) = rule.pointer_mut("/trigger/resource-type") {
            kinds.sort_by(|first, second| first.as_str().cmp(&second.as_str()));
        }
        if index > 0 {
            list.push(',');
        }
        write!(list, "{rule}")?;
    }
    list.push(']');
    Ok(list)
}

fn never_block(url_filter: &str) -> CbRule {
    CbRule { action: CbAction { typ: CbType::IgnorePreviousRules, selector: None }, trigger: CbTrigger { url_filter: url_filter.into(), ..Default::default() } }
}

/// At most `limit` rules, in their order. Blocking rules are dropped from the end, never an exception: without it, what a
/// list allows would be blocked.
fn within(rules: Vec<CbRule>, limit: usize) -> Vec<CbRule> {
    let exception = |rule: &CbRule| rule.action.typ == CbType::IgnorePreviousRules;
    let mut room = limit.saturating_sub(rules.iter().filter(|rule| exception(rule)).count());
    rules
        .into_iter()
        .filter(|rule| {
            if exception(rule) {
                return true;
            }
            let kept = room > 0;
            room = room.saturating_sub(1);
            kept
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Shield;
    use regex::RegexBuilder;

    #[test]
    fn the_compiled_copy_is_filed_by_what_webkit_compiles() {
        let key = |lists: &str| content_blocker_key(&content_blocker(lists).unwrap());
        let kinds = "||ads.example^$script,image,stylesheet,font,media,xmlhttprequest";
        let first = key(kinds);
        // The same lists at another launch: the same key, whatever order the converter held a rule's kinds in.
        assert!((0..20).all(|_| key(kinds) == first));
        assert_ne!(key("||other.example^$script,image,stylesheet,font,media,xmlhttprequest"), first);
        assert_ne!(key("||ads.example^$script"), first);
    }

    fn rules(lists: &str) -> Vec<CbRule> {
        serde_json::from_str(&content_blocker(lists).unwrap()).unwrap()
    }

    /// As WebKit reads the list: in order, a blocking rule blocks, an exception undoes it. Rules limited to a kind of
    /// resource or of page are left aside: the addresses asked about here meet none.
    fn webkit_blocks(rules: &[CbRule], url: &str) -> bool {
        let anywhere = rules.iter().filter(|rule| rule.trigger.resource_type.is_none() && rule.trigger.load_type.is_empty());
        anywhere.fold(false, |blocked, rule| {
            let pattern = RegexBuilder::new(&rule.trigger.url_filter).case_insensitive(true).build().unwrap();
            if pattern.is_match(url) { rule.action.typ == CbType::Block } else { blocked }
        })
    }

    #[test]
    fn webkit_and_the_engine_agree() {
        let lists = "||ads.example.com^\n@@||ads.example.com/ok.js\n/banner-ad.";
        let (converted, shield) = (rules(lists), Shield::new(lists, true));
        for url in [
            "https://googleads.g.doubleclick.net/pagead/id",
            "https://www.youtube.com/api/stats/ads?ver=2",
            "https://www.youtube.com/youtubei/v1/player",
            "https://ads.example.com/a.js",
            "https://ads.example.com/ok.js",
            "https://site.test/banner-ad.png",
            "https://site.test/song.webm",
        ] {
            assert_eq!(webkit_blocks(&converted, url), shield.should_block(url, "https://site.test/", "script"), "{url}");
        }
    }

    #[test]
    fn the_apps_own_addresses_are_never_blocked() {
        let converted = rules("/banner-ad.");
        assert!(webkit_blocks(&converted, "https://site.test/banner-ad.png"));
        for url in ["tauri://localhost/assets/banner-ad.js", "ipc://localhost/banner-ad.status", "art://localhost/banner-ad.jpg", "blob:tauri://localhost/banner-ad.1"] {
            assert!(!webkit_blocks(&converted, url), "{url}");
        }
    }

    #[test]
    fn a_rule_for_kinds_webkit_cant_name_never_widens_to_every_kind() {
        let converted = rules("/popunder/*$document
/smartpop/$popup");
        assert!(converted.iter().all(|rule| rule.trigger.resource_type.as_ref().is_none_or(|kinds| !kinds.is_empty())));
        assert!(!webkit_blocks(&converted, "https://site.test/popunder/script.js"));
    }

    #[test]
    fn page_hiding_rules_are_left_out() {
        assert!(rules("##.advert\nsite.test##.sponsor").iter().all(|rule| rule.action.selector.is_none()));
    }

    #[test]
    fn a_long_list_loses_blocking_rules_never_exceptions() {
        let block = |url_filter: &str| CbRule { action: CbAction { typ: CbType::Block, selector: None }, trigger: CbTrigger { url_filter: url_filter.into(), ..Default::default() } };
        let kept = within(vec![block("first"), block("second"), block("third"), never_block("allowed")], 3);
        let filters: Vec<_> = kept.iter().map(|rule| rule.trigger.url_filter.as_str()).collect();
        assert_eq!(filters, ["first", "second", "allowed"]);
    }
}
