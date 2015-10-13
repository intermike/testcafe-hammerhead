var Promise     = Hammerhead.get('es6-promise').Promise;
var cookieUtils = Hammerhead.get('./utils/cookie');
var settings    = Hammerhead.get('./settings');
var urlUtils    = Hammerhead.get('./utils/url');

var transport     = Hammerhead.transport;
var nativeMethods = Hammerhead.nativeMethods;
var cookieSandbox = Hammerhead.sandbox.cookie;

function setCookie (value) {
    return setProperty(document, 'cookie', value);
}

function getCookie () {
    return getProperty(document, 'cookie');
}

asyncTest('cookie must be to send to a server before form.submit', function () {
    var form                          = document.body.appendChild(document.createElement('form'));
    var storedAsyncServiceMsg         = transport.asyncServiceMsg;
    var resolveAsyncServiceMsgPromise = null;
    var storedNativeSubmit            = nativeMethods.formSubmit;
    var msgReceived                   = false;

    transport.asyncServiceMsg = function () {
        return new Promise(function (resolve) {
            resolveAsyncServiceMsgPromise = resolve;
        });
    };

    nativeMethods.formSubmit = function () {
        ok(msgReceived);

        nativeMethods.formSubmit  = storedNativeSubmit;
        transport.asyncServiceMsg = storedAsyncServiceMsg;

        start();
    };

    cookieSandbox.setCookie(document, 'cookie=1');

    overrideDomMeth(form);

    form.submit();

    window.setTimeout(function () {
        msgReceived = true;
        resolveAsyncServiceMsgPromise();
    }, 500);
});

test('get/set', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;

    transport.queuedAsyncServiceMsg = function () {
    };

    var cookieStrs = [
        'Test1=Basic; expires=Wed, 13-Jan-2021 22:23:01 GMT',
        'Test2=PathMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/',
        'Test4=DomainMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.' + document.location.host.toString(),
        'Test5=DomainNotMatch; expires=Wed, 13-Jan-2021 22:23:01 GMT; domain=.cbf4e2d79.com',
        'Test6=HttpOnly; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; HttpOnly',
        'Test7=Secure; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/; Secure',
        'Test8=Expired; expires=Wed, 13-Jan-1977 22:23:01 GMT; path=/',
        'Test9=Duplicate; One=More; expires=Wed, 13-Jan-2021 22:23:01 GMT; path=/'
    ];

    for (var i = 0; i < cookieStrs.length; i++)
        setCookie(cookieStrs[i]);

    strictEqual(getCookie(), 'Test1=Basic; Test2=PathMatch; Test4=DomainMatch; Test7=Secure; Test9=Duplicate');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});

asyncTest('path validation', function () {
    var iframe = document.createElement('iframe');
    var src    = window.QUnitGlobals.getResourceUrl('../../data/cookie-sandbox/validation.html', 'cookie-sandbox/validation.html');

    iframe.src = urlUtils.getProxyUrl(src);
    iframe.addEventListener('load', function () {
        ok(this.contentWindow.runTest());
        this.parentNode.removeChild(this);
        start();
    });

    document.body.appendChild(iframe);
});

test('remove real cookie after browser processing', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;

    transport.queuedAsyncServiceMsg = function () {
    };

    var uniqKey = Math.floor(Math.random() * 1e10).toString() + '_test_key';

    var cookieStr = cookieUtils.format({
        value: 'value',
        key:   uniqKey,
        path:  location.path || location.pathname.replace(/\/.*$/, '')
    });

    setCookie(cookieStr);

    strictEqual(settings.get().cookie, uniqKey + '=value');
    ok(document.cookie.indexOf(uniqKey) === -1);

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
});

module('regression');

test('overwrite (B239496)', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            'originResourceInfo': urlUtils.parseUrl(url)
        };
    };

    transport.queuedAsyncServiceMsg = function () {
    };

    setCookie('TestKey1=TestVal1');
    setCookie('TestKey2=TestVal2');
    strictEqual(getCookie(), 'TestKey1=TestVal1; TestKey2=TestVal2');

    setCookie('TestKey1=AnotherValue');
    strictEqual(getCookie(), 'TestKey1=AnotherValue; TestKey2=TestVal2');

    setCookie('TestKey2=12;');
    strictEqual(getCookie(), 'TestKey1=AnotherValue; TestKey2=12');

    setCookie('TestKey1=NewValue');
    strictEqual(getCookie(), 'TestKey1=NewValue; TestKey2=12');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    urlUtils.parseProxyUrl          = savedUrlUtilParseProxyUrl;
});

test('delete (B239496)', function () {
    settings.get().cookie = '';

    var savedQueuedAsyncServiceMsg = transport.queuedAsyncServiceMsg;
    var savedUrlUtilParseProxyUrl  = urlUtils.parseProxyUrl;

    urlUtils.parseProxyUrl = function (url) {
        return {
            'originResourceInfo': urlUtils.parseUrl(url)
        };
    };

    transport.queuedAsyncServiceMsg = function () {
    };

    setCookie('CookieToDelete=DeleteMe');
    strictEqual(getCookie(), 'CookieToDelete=DeleteMe');

    setCookie('NotExistent=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(getCookie(), 'CookieToDelete=DeleteMe');

    setCookie('CookieToDelete=; expires=Thu, 01 Jan 1970 00:00:01 GMT;');
    strictEqual(getCookie(), '');

    transport.queuedAsyncServiceMsg = savedQueuedAsyncServiceMsg;
    urlUtils.parseProxyUrl          = savedUrlUtilParseProxyUrl;
});
