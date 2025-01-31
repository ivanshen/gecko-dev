/* Any copyright is dedicated to the Public Domain.
http://creativecommons.org/publicdomain/zero/1.0/ */

"use strict";

XPCOMUtils.defineLazyServiceGetter(
  this,
  "gExternalProtocolService",
  "@mozilla.org/uriloader/external-protocol-service;1",
  "nsIExternalProtocolService"
);

const kDefaultHandlerList = Services.prefs
  .getChildList("gecko.handlerService.schemes")
  .filter(p => {
    try {
      let val = Services.prefs.getComplexValue(p, Ci.nsIPrefLocalizedString)
        .data;
      return !!val;
    } catch (ex) {
      return false;
    }
  });

add_task(async function test_check_defaults_get_added() {
  let protocols = new Set(
    kDefaultHandlerList.map(p => p.match(/schemes\.(\w+)/)[1])
  );
  for (let protocol of protocols) {
    const kPrefStr = `schemes.${protocol}.`;
    let matchingPrefs = kDefaultHandlerList.filter(p => p.includes(kPrefStr));
    let protocolHandlerCount = matchingPrefs.length / 2;
    Assert.ok(
      protocolHandlerCount,
      `Prefs for ${protocol} have at least 1 protocol handler`
    );
    Assert.ok(
      gHandlerService.wrappedJSObject._store.data.schemes[protocol].stubEntry,
      `Expect stub for ${protocol}`
    );
    let info = gExternalProtocolService.getProtocolHandlerInfo(protocol, {});
    Assert.ok(
      info,
      `Should be able to get protocol handler info for ${protocol}`
    );
    let handlers = Array.from(
      info.possibleApplicationHandlers.enumerate(Ci.nsIHandlerApp)
    );
    handlers = handlers.filter(h => h instanceof Ci.nsIWebHandlerApp);
    Assert.equal(
      handlers.length,
      protocolHandlerCount,
      `Default web handlers for ${protocol} should match`
    );
    let { alwaysAskBeforeHandling, preferredAction } = info;
    // Actually store something, pretending there was a change:
    let infoToWrite = gExternalProtocolService.getProtocolHandlerInfo(
      protocol,
      {}
    );
    gHandlerService.store(infoToWrite);
    ok(
      !gHandlerService.wrappedJSObject._store.data.schemes[protocol].stubEntry,
      "Expect stub entry info to go away"
    );

    let newInfo = gExternalProtocolService.getProtocolHandlerInfo(protocol, {});
    Assert.equal(
      alwaysAskBeforeHandling,
      newInfo.alwaysAskBeforeHandling,
      protocol + " - always ask shouldn't change"
    );
    Assert.equal(
      preferredAction,
      newInfo.preferredAction,
      protocol + " - preferred action shouldn't change"
    );
    await deleteHandlerStore();
  }
});

add_task(async function test_check_default_modification() {
  let mailtoHandlerCount =
    kDefaultHandlerList.filter(p => p.includes("mailto")).length / 2;
  Assert.ok(mailtoHandlerCount, "Prefs have at least 1 mailto handler");
  Assert.ok(
    true,
    JSON.stringify(gHandlerService.wrappedJSObject._store.data.schemes.mailto)
  );
  Assert.ok(
    gHandlerService.wrappedJSObject._store.data.schemes.mailto.stubEntry,
    "Expect stub for mailto"
  );
  let mailInfo = gExternalProtocolService.getProtocolHandlerInfo("mailto", {});
  mailInfo.alwaysAskBeforeHandling = false;
  mailInfo.preferredAction = Ci.nsIHandlerInfo.useSystemDefault;
  gHandlerService.store(mailInfo);
  Assert.ok(
    !gHandlerService.wrappedJSObject._store.data.schemes.mailto.stubEntry,
    "Stub entry should be removed immediately."
  );
  let newMail = gExternalProtocolService.getProtocolHandlerInfo("mailto", {});
  Assert.equal(newMail.preferredAction, Ci.nsIHandlerInfo.useSystemDefault);
  Assert.equal(newMail.alwaysAskBeforeHandling, false);
  await deleteHandlerStore();
});
