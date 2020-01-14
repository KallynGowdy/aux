import {
    GLOBALS_BOT_ID,
    DEVICE_BOT_ID,
    Bot as NormalBot,
    ScriptBot,
    BOT_SPACE_TAG,
    CREATE_ACTION_NAME,
    DESTROY_ACTION_NAME,
    MOD_DROP_ACTION_NAME,
    BotsState,
    CREATE_ANY_ACTION_NAME,
} from '../bots/Bot';
import {
    UpdateBotAction,
    BotAction,
    AddBotAction,
    action,
    RemoveBotAction,
    botRemoved,
    botAdded,
    toast as toastMessage,
    tweenTo as calcTweenTo,
    openQRCodeScanner as calcOpenQRCodeScanner,
    loadSimulation as calcLoadSimulation,
    unloadSimulation as calcUnloadSimulation,
    superShout as calcSuperShout,
    showQRCode as calcShowQRCode,
    goToDimension as calcGoToContext,
    goToURL as calcGoToURL,
    playSound as calcPlaySound,
    openURL as calcOpenURL,
    importAUX as calcImportAUX,
    showInputForTag as calcShowInputForTag,
    botUpdated,
    sayHello as calcSayHello,
    shell as calcShell,
    openConsole as calcOpenConsole,
    echo as calcEcho,
    backupToGithub as calcBackupToGithub,
    backupAsDownload as calcBackupAsDownload,
    openBarcodeScanner as calcOpenBarcodeScanner,
    showBarcode as calcShowBarcode,
    checkout as calcCheckout,
    finishCheckout as calcFinishCheckout,
    webhook as calcWebhook,
    reject as calcReject,
    html as htmlMessage,
    hideHtml as hideHtmlMessage,
    loadFile as calcLoadFile,
    saveFile as calcSaveFile,
    replaceDragBot as calcReplaceDragBot,
    setupUniverse as calcSetupChannel,
    setClipboard as calcSetClipboard,
    showChat as calcShowRun,
    hideChat as calcHideRun,
    runScript,
    download,
    showUploadAuxFile as calcShowUploadAuxFile,
} from '../bots/BotEvents';
import { calculateActionResultsUsingContext } from '../bots/BotsChannel';
import uuid from 'uuid/v4';
import every from 'lodash/every';
import {
    calculateFormulaValue,
    isBot,
    // isFormulaObject,
    // unwrapProxy,
    isBotInDimension,
    tagsOnBot,
    isDestroyable,
    isInUsernameList,
    getBotUsernameList,
    trimTag,
    trimEvent,
    hasValue,
    createBot,
    isScriptBot,
    getBotSpace,
} from '../bots/BotCalculations';

import '../polyfill/Array.first.polyfill';
import '../polyfill/Array.last.polyfill';
import {
    getBotState,
    getCalculationContext,
    getActions,
    setBotState,
    getUserId,
    getEnergy,
    setEnergy,
    addAction,
    getCurrentBot,
} from './formula-lib-globals';
import {
    remote as calcRemote,
    DeviceSelector,
} from '@casual-simulation/causal-trees';
import { dotCaseToCamelCase } from '../utils';

/**
 * The list of possible barcode formats.
 */
export type BarcodeFormat =
    | 'code128'
    | 'code39'
    | 'ean13'
    | 'ean8'
    | 'upc'
    | 'itf14'
    | 'msi'
    | 'pharmacode'
    | 'codabar';

/**
 * Defines the possible input types.
 */
type ShowInputType = 'text' | 'color';

/**
 * Defines the possible input types.
 */
type ShowInputSubtype = 'basic' | 'swatch' | 'advanced';

/**
 * Defines an interface for options that a show input event can use.
 */
interface ShowInputOptions {
    /**
     * The type of input box to show.
     */
    type: ShowInputType;

    /**
     * The subtype of input box to show.
     */
    subtype: ShowInputSubtype;

    /**
     * The title that should be used for the input.
     */
    title: string;

    /**
     * The placeholder for the value.
     */
    placeholder: string;

    /**
     * The background color to use.
     */
    backgroundColor: string;

    /**
     * The foreground color to use.
     */
    foregroundColor: string;
}

/**
 * Defines an interface for options that show a payment box.
 */
interface CheckoutOptions {
    /**
     * The ID of the product that is being purchased.
     */
    productId: string;

    /**
     * The title that should be shown for the product.
     */
    title: string;

    /**
     * The description that should be shown for the product.
     */
    description: string;

    /**
     * The universe that the payment should be processed on.
     */
    processingUniverse: string;

    /**
     * Whether to request the payer's billing address.
     */
    requestBillingAddress?: boolean;

    /**
     * Specifies the options that should be used for requesting payment from Apple Pay or the Payment Request API.
     */
    paymentRequest?: PaymentRequestOptions;
}

/**
 * Defines an interface of payment request options.
 */
export interface PaymentRequestOptions {
    /**
     * The two letter country code of your payment processor account.
     */
    country: string;

    /**
     * The three character currency code.
     */
    currency: string;

    /**
     * The total that should be charged to the user.
     */
    total: {
        /**
         * The label that should be displayed for the total.
         */
        label: string;

        /**
         * The amount in the currency's smallest unit. (cents, etc.)
         */
        amount: number;
    };
}

/**
 * Defines an interface for options that complete payment for a product.
 */
interface FinishCheckoutOptions {
    /**
     * The token that authorized payment from the user.
     */
    token: string;

    /**
     * The amount that should be charged in the currency's smallest unit. (cents, etc.)
     */
    amount: number;

    /**
     * The three character currency code.
     */
    currency: string;

    /**
     * The description for the charge.
     */
    description: string;

    /**
     * Any extra info that should be included in the onPaymentSuccessful() or onPaymentFailed() events for this checkout.
     */
    extra: any;
}

/**
 * Defines a set of options for a webhook.
 */
export interface WebhookOptions {
    /**
     * The HTTP Method that the request should use.
     */
    method?: string;

    /**
     * The URL that the request should be made to.
     */
    url?: string;

    /**
     * The headers to include in the request.
     */
    headers?: {
        [key: string]: string;
    };

    /**
     * The data to send with the request.
     */
    data?: any;

    /**
     * The shout that should be made when the request finishes.
     */
    responseShout?: string;
}

/**
 * Options for loading a file.
 */
interface LoadFileOptions {
    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;
}

/**
 * Options for saving a file.
 */
interface SaveFileOptions {
    /**
     * The shout that should be made when the request finishes.
     */
    callbackShout?: string;

    /**
     * Whether to overwrite an existing file.
     */
    overwriteExistingFile?: boolean;
}

/**
 * An interface that is used to say which user/device/session an event should be sent to.
 */
export interface SessionSelector {
    username?: string;
    device?: string;
    session?: string;
}

interface BotTags {
    [key: string]: any;
}

/**
 * Defines the basic structure of a bot.
 */
interface Bot {
    /**
     * The ID of the bot.
     */
    id: string;

    /**
     * The space the bot lives in.
     */
    space?: BotType;

    /**
     * The calculated tag values that the bot contains.
     */
    tags: BotTags;

    /**
     * The raw tag values that the bot contains.
     * If you want to access the script code for a formula, use this.
     * Otherwise, use the tags property.
     */
    raw: BotTags;

    /**
     * The tags that have been changed on this bot.
     */
    changes: BotTags;
}

/**
 * The possible bot types.
 */
type BotType = 'shared' | 'local' | 'tempLocal';

/**
 * Defines a tag filter. It can be either a function that accepts a tag value and returns true/false or it can be the value that the tag value has to match.
 */
type TagFilter =
    | ((value: any) => boolean)
    | string
    | number
    | boolean
    | null
    | undefined;

/**
 * Defines a bot filter. It is a function that accepts a bot and returns true/false.
 *
 * Common bot filters are:
 * - `byTag(tag, value)`
 * - `inDimension(dimension)`
 * - `atPosition(dimension, x, y)`
 * - `inStack(bot, dimension)`
 * - `neighboring(bot, dimension, direction)`
 * - `either(filter1, filter2)`
 * - `not(filter)`
 */
interface BotFilterFunction {
    (bot: Bot): boolean;
    sort?: (bot: Bot) => any;
}

/**
 * Defines a type that represents a mod.
 * That is, a set of tags that can be applied to another bot.
 */
type Mod = BotTags | Bot;

/**
 * Defines the possible camera types.
 */
type CameraType = 'front' | 'rear';

/**
 * Sums the given array of numbers and returns the result.
 * If any value in the list is not a number, it will be converted to one.
 * If the given value is not an array, then it will be converted to a number and returned.
 *
 * @param list The value that should be summed. If it is a list, then the result will be the sum of the items in the list.
 *             If it is not a list, then the result will be the value converted to a number.
 */
function sum(list: any): number {
    if (!Array.isArray(list)) {
        return parseFloat(list);
    }

    let carry = 0;
    for (let i = 0; i < list.length; i++) {
        const l = list[i];
        if (!Array.isArray(l)) {
            carry += parseFloat(l);
        } else {
            carry += sum(l);
        }
    }
    return carry;
}

/**
 * Calculates the average of the numbers in the given list and returns the result.
 * @param list The value that should be averaged.
 *             If it is a list, then the result will be sum(list)/list.length.
 *             If it is not a list, then the result will be the value converted to a number.
 */
function avg(list: any) {
    if (!Array.isArray(list)) {
        return parseFloat(list);
    }

    let total = sum(list);
    let count = list.length;
    return total / count;
}

/**
 * Calculates the square root of the given number.
 * @param value The number.
 */
function sqrt(value: any) {
    return Math.sqrt(parseFloat(value));
}

/**
 * Calculates the absolute value of a number.
 * @param number The number to get the absolute value of.
 */
function abs(number: any) {
    return Math.abs(parseFloat(number));
}

/**
 * Calculates the standard deviation of the numbers in the given list and returns the result.
 *
 * @param list The value that the standard deviation should be calculated for.
 */
function stdDev(list: any) {
    if (!Array.isArray(list)) {
        list = [parseFloat(list)];
    }

    let mean = avg(list);
    let numbersMinusMean = list.map((l: number) => (l - mean) * (l - mean));

    let standardMean = avg(numbersMinusMean);
    return sqrt(standardMean);
}

/**
 * Generates a random integer number between min and max.
 * @param min The smallest allowed value.
 * @param max The largest allowed value.
 */
function randomInt(min: number = 0, max?: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    const rand = Math.random();
    if (max) {
        return Math.floor(rand * (max - min)) + min;
    } else {
        return Math.floor(rand) + min;
    }
}

/**
 * Generates a random number between min and max.
 * @param min The smallest allowed value.
 * @param max The largest allowed value.
 */
function random(min: number = 0, max?: number): number {
    const rand = Math.random();
    if (max) {
        return rand * (max - min) + min;
    } else {
        return rand + min;
    }
}

/**
 * Removes the given bot or bot ID from the simulation.
 * @param bot The bot or bot ID to remove from the simulation.
 */
function destroyBot(bot: Bot | string) {
    const calc = getCalculationContext();

    let id: string;
    if (typeof bot === 'object') {
        id = bot.id;
    } else if (typeof bot === 'string') {
        id = bot;
    }

    if (typeof id === 'object') {
        id = (<any>id).valueOf();
    }

    const realBot = getBotState()[id];
    if (!realBot) {
        return;
    }

    if (!isDestroyable(calc, realBot)) {
        return;
    }

    if (id) {
        event(DESTROY_ACTION_NAME, [id]);
        let actions = getActions();
        actions.push(botRemoved(id));
        calc.sandbox.interface.removeBot(id);
    }

    destroyChildren(id);
}

/**
 * Destroys the given bot, bot ID, or list of bots.
 * @param bot The bot, bot ID, or list of bots to destroy.
 */
function destroy(bot: Bot | string | Bot[]) {
    if (typeof bot === 'object' && Array.isArray(bot)) {
        bot.forEach(f => destroyBot(f));
    } else {
        destroyBot(bot);
    }
}

/**
 * Removes tags from the given list of bots.
 * @param bot The bot, bot ID, or list of bots that should have their matching tags removed.
 * @param tagSection The tag section which should be removed from the bot(s). If given a string, then all the tags
 *                   starting with the given name will be removed. If given a RegExp, then all the tags matching the regex will be removed.
 *
 * @example
 * // Remove tags named starting with "abc" from the `this` bot.
 * removeTags(this, "abc");
 *
 * @example
 * // Remove tags named "hello" using a case-insensitive regex from the `this` bot.
 * removeTags(this, /^hello$/gi);
 *
 */
function removeTags(bot: Bot | Bot[], tagSection: string | RegExp) {
    if (typeof bot === 'object' && Array.isArray(bot)) {
        let botList: any[] = bot;

        for (let h = 0; h < bot.length; h++) {
            let currentBot = botList[h];
            let tags = tagsOnBot(currentBot);

            for (let i = tags.length - 1; i >= 0; i--) {
                if (tagSection instanceof RegExp) {
                    if (tagSection.test(tags[i])) {
                        setTag(currentBot, tags[i], null);
                    }
                } else if (tags[i].indexOf(tagSection) === 0) {
                    setTag(currentBot, tags[i], null);
                }
            }
        }
    } else {
        let tags = tagsOnBot(bot);

        for (let i = tags.length - 1; i >= 0; i--) {
            // if the tag section is relevant to the curretn tag at all
            if (tagSection instanceof RegExp) {
                if (tagSection.test(tags[i])) {
                    setTag(bot, tags[i], null);
                }
            } else if (tags[i].indexOf(tagSection) === 0) {
                // if the tag starts with the tag section
                setTag(bot, tags[i], null);
            }
        }
    }
}

/**
 * Renames the tags on the given bot or bots from using dot casing (dot.case) to camel casing (camelCasing).
 * This is a helper function to make it easier to update your bots.
 * @param bot The bot or array of bots that should be updated.
 */
function renameTagsFromDotCaseToCamelCase(bot: Bot | Bot[]) {
    if (Array.isArray(bot)) {
        for (let b of bot) {
            renameTagsSingle(b);
        }
    } else {
        renameTagsSingle(bot);
    }
}

function renameTagsSingle(bot: Bot) {
    for (let tag of tagsOnBot(bot)) {
        let updated = dotCaseToCamelCase(tag);
        if (updated !== tag) {
            const val = getTag(bot, tag);
            setTag(bot, updated, val);
            setTag(bot, tag, null);
        }
    }
}

function destroyChildren(id: string) {
    const calc = getCalculationContext();
    const children: Bot[] = calc.sandbox.interface.listObjectsWithTag(
        'auxCreator',
        id
    );
    children.forEach(child => {
        if (!isDestroyable(calc, child)) {
            return;
        }
        let actions = getActions();
        actions.push(botRemoved(child.id));
        calc.sandbox.interface.removeBot(child.id);
        destroyChildren(child.id);
    });
}

/**
 * Creates a new bot that contains the given tags.
 * @param mods The mods that specify what tags to set on the bot.
 */
function createFromMods(idFactory: () => string, ...mods: (Mod | Mod[])[]) {
    let variants: Mod[][] = new Array<Mod[]>(1);
    variants[0] = [];

    for (let i = 0; i < mods.length; i++) {
        let diff = mods[i];
        if (Array.isArray(diff)) {
            let newVariants: Mod[][] = new Array<Mod[]>(
                variants.length * diff.length
            );

            for (let b = 0; b < newVariants.length; b++) {
                let diffIdx = Math.floor(b / variants.length);
                let d = diff[diffIdx];
                let variantIdx = b % variants.length;
                let newVariant = variants[variantIdx].slice();
                newVariant.push(d);
                newVariants[b] = newVariant;
            }

            variants = newVariants;
        } else if (typeof diff === 'object') {
            for (let b = 0; b < variants.length; b++) {
                variants[b].push(diff);
            }
        }
    }

    let bots: NormalBot[] = variants.map(v => {
        let bot: NormalBot = {
            id: idFactory(),
            tags: {},
        };
        for (let i = v.length - 1; i >= 0; i--) {
            const mod = v[i];
            if (mod && BOT_SPACE_TAG in mod) {
                const space = mod[BOT_SPACE_TAG];
                if (hasValue(space)) {
                    bot.space = space;
                }
                break;
            }
        }
        applyMod(bot.tags, ...v);

        if ('auxCreator' in bot.tags) {
            const creatorId = bot.tags['auxCreator'];
            const creator = getBot('id', creatorId);
            let clearCreator = false;
            if (!creator) {
                clearCreator = true;
            } else {
                const creatorSpace = getBotSpace(creator);
                const currentSpace = getBotSpace(bot);
                if (creatorSpace !== currentSpace) {
                    clearCreator = true;
                }
            }

            if (clearCreator) {
                applyMod(bot.tags, { auxCreator: null });
            }
        }

        return bot;
    });

    let actions = getActions();
    actions.push(...bots.map(f => botAdded(f)));

    let ret = new Array<ScriptBot>(bots.length);
    const calc = getCalculationContext();
    for (let i = 0; i < bots.length; i++) {
        ret[i] = calc.sandbox.interface.addBot(bots[i]);
        setBotState(
            Object.assign({}, getBotState(), {
                [bots[i].id]: bots[i],
            })
        );
    }

    event(CREATE_ACTION_NAME, ret);
    for (let bot of ret) {
        event(CREATE_ANY_ACTION_NAME, null, {
            bot: bot,
        });
    }

    if (ret.length === 1) {
        return ret[0];
    } else {
        return ret;
    }
}

/**
 * Gets the ID from the given bot.
 * @param bot The bot or string.
 */
function getID(bot: Bot | string): string {
    if (typeof bot === 'string') {
        return bot || null;
    } else if (bot) {
        return bot.id || null;
    }

    return null;
}

/**
 * Gets JSON for the given data.
 * @param data The data.
 */
function getJSON(data: any): string {
    return JSON.stringify(data);
}

function createBase(idFactory: () => string, ...datas: Mod[]) {
    let parent = getCurrentBot();
    let parentDiff = parent ? { auxCreator: getID(parent) } : {};
    return createFromMods(idFactory, parentDiff, ...datas);
}

/**
 * Creates a new bot and returns it.
 * @param parent The bot that should be the parent of the new bot.
 * @param mods The mods which specify the new bot's tag values.
 * @returns The bot(s) that were created.
 *
 * @example
 * // Create a red bot without a parent.
 * let redBot = create(null, { "auxColor": "red" });
 *
 * @example
 * // Create a red bot and a blue bot with `this` as the parent.
 * let [redBot, blueBot] = create(this, [
 *    { "auxColor": "red" },
 *    { "auxColor": "blue" }
 * ]);
 *
 */
function create(...mods: Mod[]) {
    return createBase(() => uuid(), ...mods);
}

/**
 * Runs an event on the given bots.
 * @param name The name of the event to run.
 * @param bots The bots that the event should be executed on. If null, then the event will be run on every bot.
 * @param arg The argument to pass.
 * @param sort Whether to sort the Bots before processing. Defaults to true.
 */
function event(
    name: string,
    bots: (Bot | string)[],
    arg?: any,
    sort?: boolean
) {
    const state = getBotState();
    if (!!state) {
        let ids = !!bots
            ? bots.map(bot => {
                  return typeof bot === 'string' ? bot : bot.id;
              })
            : null;

        let [events, results] = calculateActionResultsUsingContext(
            state,
            action(trimEvent(name), ids, getUserId(), arg, sort),
            getCalculationContext()
        );

        let actions = getActions();
        actions.push(...events);

        return results;
    }
}

/**
 * Performs the given action.
 * @param action The action to perform.
 */
function perform(action: any) {
    return addAction(action);
}

/**
 * Rejects the given action.
 * @param action The action to reject.
 */
function reject(action: any) {
    const event = calcReject(action);
    return addAction(event);
}

/**
 * Asks every bot in the universe to run the given action.
 * In effect, this is like shouting to a bunch of people in a room.
 *
 * @param name The event name.
 * @param arg The optional argument to include in the shout.
 * @returns Returns a list which contains the values returned from each script that was run for the shout.
 *
 * @example
 * // Tell every bot to reset themselves.
 * shout("reset()");
 *
 * @example
 * // Ask every bot for its name.
 * const names = shout("getName()");
 *
 * @example
 * // Tell every bot say "Hi" to you.
 * shout("sayHi()", "My Name");
 */
function shout(name: string, arg?: any) {
    return event(name, null, arg);
}

/**
 * Shouts the given event to every bot in every loaded simulation.
 * @param eventName The name of the event to shout.
 * @param arg The argument to shout. This gets passed as the `that` variable to the other scripts.
 */
function superShout(eventName: string, arg?: any) {
    const event = calcSuperShout(trimEvent(eventName), arg);
    return addAction(event);
}

/**
 * Sends a web request based on the given options.
 * @param options The options that specify where and what to send in the web request.
 *
 * @example
 * // Send a HTTP POST request to https://www.example.com/api/createThing
 * webhook({
 *   method: 'POST',
 *   url: 'https://www.example.com/api/createThing',
 *   data: {
 *     hello: 'world'
 *   },
 *   responseShout: 'requestFinished'
 * });
 */
let webhook: {
    (options: WebhookOptions): BotAction;

    /**
     * Sends a HTTP POST request to the given URL with the given data.
     *
     * @param url The URL that the request should be sent to.
     * @param data That that should be sent.
     * @param options The options that should be included in the request.
     *
     * @example
     * // Send a HTTP POST request to https://www.example.com/api/createThing
     * webhook.post('https://www.example.com/api/createThing', {
     *   hello: 'world'
     * }, { responseShout: 'requestFinished' });
     */
    post: (url: string, data?: any, options?: WebhookOptions) => BotAction;
};

webhook = <any>function(options: WebhookOptions) {
    const event = calcWebhook(<any>options);
    return addAction(event);
};
webhook.post = function(url: string, data?: any, options?: WebhookOptions) {
    return webhook({
        ...options,
        method: 'POST',
        url: url,
        data: data,
    });
};

/**
 * Asks the given bots to run the given action.
 * In effect, this is like whispering to a specific set of people in a room.
 *
 * @param bot The bot(s) to send the event to.
 * @param eventName The name of the event to send.
 * @param arg The optional argument to include.
 * @returns Returns a list which contains the values returned from each script that was run for the shout.
 *
 * @example
 * // Tell all the red bots to reset themselves.
 * whisper(getBots("#auxColor", "red"), "reset()");
 *
 * @example
 * // Ask all the tall bots for their names.
 * const names = whisper(getBots("auxScaleZ", height => height >= 2), "getName()");
 *
 * @example
 * // Tell every friendly bot to say "Hi" to you.
 * whisper(getBots("friendly", true), "sayHi()", "My Name");
 */
function whisper(
    bot: (Bot | string)[] | Bot | string,
    eventName: string,
    arg?: any
) {
    let bots;
    if (Array.isArray(bot)) {
        bots = bot;
    } else {
        bots = [bot];
    }

    return event(eventName, bots, arg, false);
}

/**
 * Sends the given operation to all the devices that matches the given selector.
 * In effect, this allows users to send each other events directly without having to edit tags.
 *
 * Note that currently, devices will only accept events sent from the server.
 *
 * @param event The event that should be executed in the remote session(s).
 * @param selector The selector that indicates where the event should be sent. The event will be sent to all sessions that match the selector.
 *                 For example, specifying a username means that the event will be sent to every active session that the user has open.
 *                 If a selector is not specified, then the event is sent to the server.
 *
 * @example
 * // Send a toast to all sessions for the username "bob"
 * remote(player.toast("Hello, Bob!"), { username: "bob" });
 */
function remote(event: BotAction, selector?: SessionSelector) {
    if (!event) {
        return;
    }
    let actions = getActions();
    const r = calcRemote(event, convertSessionSelector(selector));
    const index = actions.indexOf(event);
    if (index >= 0) {
        actions[index] = r;
    } else {
        actions.push(r);
    }
}

function convertSessionSelector(selector: SessionSelector): DeviceSelector {
    return selector
        ? {
              sessionId: selector.session,
              username: selector.username,
              deviceId: selector.device,
          }
        : undefined;
}

/**
 * Replaces the bot that the user is beginning to drag.
 * Only works from inside a onDrag() or onAnyBotDrag() listen tag.
 * @param bot The bot or mod that should be dragged instead of the original.
 */
function replaceDragBot(bot: Mod) {
    const event = calcReplaceDragBot(unwrapBotOrMod(bot));
    return addAction(event);
}

/**
 * Sets the text stored in the player's clipboard.
 * @param text The text to set to the clipboard.
 */
function setClipboard(text: string) {
    const event = calcSetClipboard(text);
    return addAction(event);
}

/**
 * Redirects the user to the given dimension.
 * @param dimension The dimension to go to.
 *
 * @example
 * // Send the player to the "welcome" dimension.
 * player.goToDimension("welcome");
 */
function goToDimension(dimension: string) {
    const event = calcGoToContext(dimension);
    return addAction(event);
}

/**
 * Redirects the user to the given URL.
 * @param url The URL to go to.
 *
 * @example
 * // Send the player to wikipedia.
 * player.goToURL("https://wikipedia.org");
 */
function goToURL(url: string) {
    const event = calcGoToURL(url);
    return addAction(event);
}

/**
 * Redirects the user to the given URL.
 * @param url The URL to go to.
 *
 * @example
 * // Open wikipedia in a new tab.
 * player.openURL("https://wikipedia.org");
 */
function openURL(url: string) {
    const event = calcOpenURL(url);
    return addAction(event);
}

/**
 * Shows an input box to edit the given bot and tag.
 *
 * @param bot The bot or bot ID that should be edited.
 * @param tag The tag which should be edited on the bot.
 * @param options The options that indicate how the input box should be customized.
 *
 * @example
 * // Show an input box for `this` bot's label.
 * player.showInputForTag(this, "auxLabel", {
 *            title: "Change the label",
 *            type: "text"
 * });
 *
 * @example
 * // Show a color picker for the bot's color.
 * player.showInputForTag(this, "auxColor", {
 *            title: "Change the color",
 *            type: "color",
 *            subtype: "advanced"
 * });
 */
function showInputForTag(
    bot: Bot | string,
    tag: string,
    options?: Partial<ShowInputOptions>
) {
    const id = typeof bot === 'string' ? bot : bot.id;
    const event = calcShowInputForTag(id, trimTag(tag), options);
    return addAction(event);
}

/**
 * Shows a checkout screen that lets the user purchase something.
 *
 * @param options The options for the payment box.
 *
 * @example
 * // Show a checkout box for 10 cookies
 * player.checkout({
 *   productId: '10_cookies',
 *   title: '10 Cookies',
 *   description: '$5.00',
 *   processingUniverse: 'cookies_checkout'
 * });
 *
 */
function checkout(options: CheckoutOptions) {
    const event = calcCheckout(options);
    return addAction(event);
}

/**
 * Finishes the checkout process by charging the payment fee to the user.
 *
 * @param options The options for finishing the checkout.
 *
 * @example
 * // Finish the checkout process
 * server.finishCheckout({
 *   token: 'token from onCheckout',
 *
 *   // 1000 cents == $10.00
 *   amount: 1000,
 *   currency: 'usd',
 *   description: 'Description for purchase'
 * });
 */
function finishCheckout(options: FinishCheckoutOptions) {
    const event = calcFinishCheckout(
        options.token,
        options.amount,
        options.currency,
        options.description,
        options.extra
    );
    return addAction(event);
}

/**
 * Derermines whether the player is in the given dimension.
 * @param dimension The dimension.
 */
function isInDimension(givenDimension: string) {
    return (
        getCurrentDimension() === givenDimension &&
        getCurrentDimension() != undefined
    );
}

/**
 * Gets the dimension that the player is currently in.
 */
function getCurrentDimension(): string {
    const user = getUser();
    if (user) {
        const dimension = getTag(user, '_auxUserDimension');
        return dimension || undefined;
    }
    return undefined;
}

/**
 * Gets the universe that the player is currently in.
 */
function getCurrentUniverse(): string {
    const user = getUser();
    if (user) {
        const universe = getTag(user, '_auxUserUniverse') as string;

        if (universe && universe.includes('/')) {
            return universe.split('/')[1];
        }

        return universe || undefined;
    }
    return undefined;
}

/**
 * Determines whether the player has the given bot in their inventory.
 * @param bots The bot or bots to check.
 */
function hasBotInInventory(bots: Bot | Bot[]): boolean {
    if (!Array.isArray(bots)) {
        bots = [bots];
    }

    return every(bots, f =>
        isBotInDimension(
            getCalculationContext(),
            <any>f,
            getInventoryDimension()
        )
    );
}

/**
 * Gets the current user's bot.
 */
function getUser(): Bot {
    if (!getUserId()) {
        return null;
    }
    const calc = getCalculationContext();
    const user = calc.sandbox.interface.listObjectsWithTag('id', getUserId());
    if (Array.isArray(user)) {
        if (user.length === 1) {
            return user[0];
        } else {
            return null;
        }
    }
    return user || null;
}

/**
 * Gets the current globals bot.
 */
function getGlobals(): Bot {
    const calc = getCalculationContext();
    const globals = calc.sandbox.interface.listObjectsWithTag(
        'id',
        GLOBALS_BOT_ID
    );
    if (Array.isArray(globals)) {
        if (globals.length === 1) {
            return globals[0];
        } else {
            return null;
        }
    }
    return globals || null;
}

/**
 * Gets the name of the dimension that is used for the current user's menu.
 */
function getMenuDimension(): string {
    const user = getUser();
    if (user) {
        return getTag(user, '_auxUserMenuDimension');
    } else {
        return null;
    }
}

/**
 * Gets the name of the dimension that is used for the current user's inventory.
 */
function getInventoryDimension(): string {
    const user = getUser();
    if (user) {
        return getTag(user, '_auxUserInventoryDimension');
    } else {
        return null;
    }
}

/**
 * Gets the first bot which matches all of the given filters.
 * @param filters The filter functions that the bot needs to match.
 * @returns The first bot that matches all the given filters.
 *
 * @example
 * // Get a bot by the "name" tag.
 * let bot = getBot(byTag("name", "The bot's name"));
 */
function getBot(...filters: BotFilterFunction[]): Bot;

/**
 * Gets the first bot ordered by ID which matches the given tag and filter.
 * @param tag The tag the bot should match.
 * @param filter The optional value or filter the bot should match.
 *
 * @example
 * // Get a bot with the "name" tag.
 * // Shorthand for getBot(byTag("name"))
 * let bot = getBot("name");
 *
 * @example
 * // Get a bot by the "name" tag.
 * // Shorthand for getBot(byTag("name", "The bot's name"))
 * let bot = getBot("name", "The bot's name");
 *
 * @example
 * // Get a bot where the "name" tag starts with the letter "N".
 * // Shorthand for getBot(byTag("name", name => name.startsWith("N")))
 * let bot = getBot("name", name => name.startsWith("N"));
 */
function getBot(tag: string, filter?: any | TagFilter): Bot;

/**
 * Gets the first bot ordered by ID.
 * @returns The bot with the first ID when sorted alphebetically.
 *
 * @example
 * let firstBot = getBot();
 */
function getBot(): Bot {
    const bots = getBots(...arguments);
    return bots.first();
}

/**
 * Gets the list of bots which match all of the given filters.
 * @param filters The filter functions that the bots need to match.
 * @returns A list of bots that match all the given filters. If no bots match then an empty list is returned.
 *
 * @example
 * // Get all the bots that are red.
 * let bots = getBots(byTag("auxColor", "red"));
 */
function getBots(...filters: ((bot: Bot) => boolean)[]): Bot[];

/**
 * Gets the list of bots that have the given tag matching the given filter value.
 * @param tag The tag the bot should match.
 * @param filter The value or filter the bot should match.
 *
 * @example
 * // Get all the bots that are red.
 * // Shorthand for getBots(byTag("auxColor", "red"))
 * let bots = getBots("auxColor", "red");
 */
function getBots(tag: string, filter?: any | TagFilter): Bot[];

/**
 * Gets a list of all the bots.
 *
 * @example
 * // Gets all the bots in the universe.
 * let bots = getBots();
 */
function getBots(): Bot[] {
    const calc = getCalculationContext();
    if (arguments.length > 0 && typeof arguments[0] === 'function') {
        return calc.sandbox.interface.listObjects(...arguments);
    } else {
        const tag: string = arguments[0];
        if (typeof tag === 'undefined') {
            return calc.sandbox.interface.objects.slice();
        } else if (!tag) {
            return [];
        }
        const filter = arguments[1];
        return calc.sandbox.interface.listObjectsWithTag(trimTag(tag), filter);
    }
}

/**
 * Gets the list of tag values from bots that have the given tag.
 * @param tag The tag.
 * @param filter THe optional filter to use for the values.
 */
function getBotTagValues(tag: string, filter?: TagFilter): any[] {
    const calc = getCalculationContext();
    return calc.sandbox.interface.listTagValues(trimTag(tag), filter);
}

/**
 * Creates a filter function that checks whether bots have the given tag and value.
 * @param tag The tag to check.
 * @param filter The value or filter that the tag should match.
 *
 * @example
 * // Find all the bots with a "name" of "bob".
 * let bobs = getBots(byTag("name", "bob"));
 *
 * @example
 * // Find all bots with a height larger than 2.
 * let bots = getBots(byTag("height", height => height > 2));
 *
 * @example
 * // Find all the bots with the "test" tag.
 * let bots = getBots(byTag("test"));
 */
function byTag(tag: string, filter?: TagFilter): BotFilterFunction {
    if (filter && typeof filter === 'function') {
        return bot => {
            let val = getTag(bot, tag);
            return hasValue(val) && filter(val);
        };
    } else if (hasValue(filter)) {
        return bot => {
            let val = getTag(bot, tag);
            return hasValue(val) && filter === val;
        };
    } else if (filter === null) {
        return bot => {
            let val = getTag(bot, tag);
            return !hasValue(val);
        };
    } else {
        return bot => {
            let val = getTag(bot, tag);
            return hasValue(val);
        };
    }
}

/**
 * Creates a filter function that checks whether bots match the given mod.
 * @param mod The mod that bots should be checked against.
 *
 * @example
 * // Find all the bots with a height set to 1 and auxColor set to "red".
 * let bots = getBots(byMod({
 *      "auxColor": "red",
 *      height: 1
 * }));
 */
function byMod(mod: Mod): BotFilterFunction {
    let tags = isBot(mod) ? mod.tags : mod;
    let filters = Object.keys(tags).map(k => byTag(k, tags[k]));
    return bot => filters.every(f => f(bot));
}

/**
 * Creates a filter function that checks whether bots are in the given dimension.
 * @param dimension The dimension to check.
 * @returns A function that returns true if the given bot is in the dimension and false if it is not.
 *
 * @example
 * // Find all the bots in the "test" dimension.
 * let bots = getBots(inDimension("test"));
 */
function inDimension(dimension: string): BotFilterFunction {
    return byTag(dimension, true);
}

/**
 * Creates a filter function that checks whether bots are at the given position in the given dimension.
 * @param dimension The dimension that the bots should be in.
 * @param x The X position in the dimension that the bots should be at.
 * @param y The Y position in the dimension that the bots should be at.
 * @returns A function that returns true if the given bot is at the given position and false if it is not.
 *
 * @example
 * // Find all the bots at (1, 2) in the "test" dimension.
 * let bots = getBots(atPosition("test", 1, 2));
 */
function atPosition(
    dimension: string,
    x: number,
    y: number
): BotFilterFunction {
    const inCtx = inDimension(dimension);
    const atX = byTag(`${dimension}X`, x);
    const atY = byTag(`${dimension}Y`, y);
    const filter: BotFilterFunction = b => inCtx(b) && atX(b) && atY(b);
    filter.sort = b => getTag(b, `${dimension}SortOrder`) || 0;
    return filter;
}

/**
 * Creates a filter function that checks whether bots were created by the given bot.
 * @param bot The bot to determine weather the bots have been created by it or not.
 * @returns A function that returns true if the bot was created by the given bot.
 *
 * @example
 * // Find all the bots created by the yellow bot.
 * let bots = getBots(byCreator(getBot('auxColor','yellow')));
 */
function byCreator(bot: Bot | string) {
    return byTag('auxCreator', getID(bot));
}

/**
 * Creates a filter function that checks whether bots are in the same stack as the given bot.
 * @param bot The bot that other bots should be checked against.
 * @param dimension The dimension that other bots should be checked in.
 * @returns A function that returns true if the given bot is in the same stack as the original bot.
 *
 * @example
 * // Find all bots in the same stack as `this` in the "test" dimension.
 * let bots = getBots(inStack(this, "test"));
 *
 */
function inStack(bot: Bot, dimension: string): BotFilterFunction {
    return atPosition(
        dimension,
        getTag(bot, `${dimension}X`),
        getTag(bot, `${dimension}Y`)
    );
}

/**
 * Creates a function that filters bots by whether they are in the given space.
 * @param space The space that the bots should be in.
 */
function bySpace(space: string): BotFilterFunction {
    return byTag(BOT_SPACE_TAG, space);
}

/**
 * Creates a function that filters bots by whether they are neighboring the given bot.
 * @param bot The bot that other bots should be checked against.
 * @param dimension The dimension that other bots should be checked in.
 * @param direction The neighboring direction to check.
 * @returns A function that returns true if the given bot is next to the original bot.
 *
 * @example
 * // Find all bots in front of `this` bot in the "test" dimension.
 * let bots = getBots(neighboring(this, "test", "front"));
 */
function neighboring(
    bot: Bot,
    dimension: string,
    direction: 'front' | 'left' | 'right' | 'back'
): BotFilterFunction {
    const offsetX = direction === 'left' ? 1 : direction === 'right' ? -1 : 0;
    const offsetY = direction === 'back' ? 1 : direction === 'front' ? -1 : 0;

    const x = getTag(bot, `${dimension}X`);
    const y = getTag(bot, `${dimension}Y`);

    return atPosition(dimension, x + offsetX, y + offsetY);
}

/**
 * Creates a function that filters bots by whether they match any of the given filters.
 * @param filters The filter functions that a bot should be tested against.
 *
 * @example
 * // Find all bots with the name "bob" or height 2.
 * let bots = getBots(
 *   either(
 *     byTag("name", "bob"),
 *     byTag("height", height => height === 2)
 *   )
 * );
 */
function either(...filters: BotFilterFunction[]): BotFilterFunction {
    return bot => filters.some(f => f(bot));
}

/**
 * Creates a function that negates the result of the given function.
 * @param filter The function whose results should be negated.
 *
 * @example
 * // Find all bots that are not in the "test" dimension.
 * let bots = getBots(not(inDimension("test")));
 */
function not(filter: BotFilterFunction): BotFilterFunction {
    return bot => !filter(bot);
}

/**
 * Gets the value of the given tag stored in the given bot.
 * @param bot The bot.
 * @param tag The tag.
 *
 * @example
 * // Get the "auxColor" tag from the `this` bot.
 * let color = getTag(this, "auxColor");
 */
function getTag(bot: Bot, ...tags: string[]): any {
    let current: any = bot;
    for (let i = 0; i < tags.length; i++) {
        if (isScriptBot(current)) {
            const tag = trimTag(tags[i]);
            const calc = getCalculationContext();
            if (calc) {
                current = calc.sandbox.interface.getTag(current, tag);
            } else {
                current = bot.tags[tag];
            }
        } else if (isBot(current)) {
            const tag = trimTag(tags[i]);
            const calc = getCalculationContext();
            if (calc) {
                const script = calc.sandbox.interface.getBot(current.id);
                if (script) {
                    current = calc.sandbox.interface.getTag(script, tag);
                } else {
                    current = bot.tags[tag];
                }
            } else {
                current = bot.tags[tag];
            }
        } else {
            return current;
        }
    }

    return current;
}

/**
 * Gets weather the current tag exists on the given bot.
 * @param bot The bot.
 * @param tag The tag to check.
 *
 * @example
 * // Determine if the "auxLabel" tag exists on the `this` bot.
 * let hasLabel = hasTag(this, "auxLabel");
 * if (hasLabel) {
 *   // Do something...
 * }
 */
function hasTag(bot: Bot, ...tags: string[]): boolean {
    let current: any = bot;
    const calc = getCalculationContext();
    for (let i = 0; i < tags.length; i++) {
        if (isScriptBot(current)) {
            const tag = trimTag(tags[i]);
            if (calc) {
                current = calc.sandbox.interface.getTag(current, tag);
            } else {
                current = bot.tags[tag];
            }
        } else {
            if (current != null && current != undefined && current != '') {
                return true;
            } else {
                return false;
            }
        }
    }

    if (current != null && current != undefined && current != '') {
        return true;
    } else {
        return false;
    }
}

/**
 * Sets the value of the given tag stored in the given bot.
 * @param bot The bot.
 * @param tag The tag to set.
 * @param value The value to set.
 *
 * @example
 * // Set a bot's color to "green".
 * setTag(this, "auxColor", "green");
 */
function setTag(bot: Bot | Bot[] | BotTags, tag: string, value: any): any {
    tag = trimTag(tag);
    if (Array.isArray(bot) && bot.length > 0 && isScriptBot(bot[0])) {
        const calc = getCalculationContext();
        for (let i = 0; i < bot.length; i++) {
            calc.sandbox.interface.setTag(bot[i] as ScriptBot, tag, value);
        }
        return value;
    } else if (bot && isScriptBot(bot)) {
        const calc = getCalculationContext();
        return calc.sandbox.interface.setTag(bot, tag, value);
    } else {
        if (tag !== 'id' && tag !== BOT_SPACE_TAG) {
            (<BotTags>bot)[tag] = value;
        }
        return value;
    }
}

/**
 * Creates a mod from exported mod data.
 * @param bot The mod data that should be loaded.
 * @param tags The tags that should be included in the output mod.
 * @returns The mod that was loaded from the data.
 */
function getMod(bot: any, ...tags: (string | RegExp)[]): Mod {
    if (typeof bot === 'string') {
        bot = JSON.parse(bot);
    }

    let diff: BotTags = {};

    let tagsObj = isBot(bot) ? bot.tags : bot;
    let botTags = isBot(bot) ? tagsOnBot(bot) : Object.keys(bot);
    for (let botTag of botTags) {
        let add = false;
        if (tags.length > 0) {
            for (let tag of tags) {
                if (tag instanceof RegExp) {
                    if (tag.test(botTag)) {
                        add = true;
                        break;
                    }
                } else {
                    if (tag === botTag) {
                        add = true;
                        break;
                    }
                }
            }
        } else {
            add = true;
        }

        if (add) {
            diff[botTag] = tagsObj[botTag];
        }
    }

    return diff;
}

/**
 * Applies the given diff to the given bot.
 * @param bot The bot.
 * @param diff The diff to apply.
 */
function applyMod(bot: any, ...diffs: Mod[]) {
    let appliedDiffs: BotTags[] = [];
    diffs.forEach(diff => {
        if (!diff) {
            return;
        }
        let tags: BotTags;
        if (isScriptBot(diff)) {
            tags = diff.raw;
        } else if (isBot(diff)) {
            tags = diff.tags;
        } else {
            tags = diff;
        }
        appliedDiffs.push(tags);
        for (let key in tags) {
            setTag(bot, key, tags[key]);
        }
    });
}

/**
 * Loads a file from the given path.
 * @param path The path that the file should be loaded from.
 */
function loadFile(path?: string, options?: LoadFileOptions) {
    const action = calcLoadFile({
        path: path,
        ...(options || {}),
    });
    return addAction(action);
}

/**
 * Saves a file at the given path.
 * @param path The path.
 * @param data The data to save.
 * @param options The options to use.
 */
function saveFile(path: string, data: string, options?: SaveFileOptions) {
    const action = calcSaveFile({
        path: path,
        data: data,
        ...(options || {}),
    });
    return addAction(action);
}

/**
 * Loads a file from the server at the given path.
 * @param path The path of the file.
 * @param options The options.
 */
function serverLoadFile(path: string, options?: LoadFileOptions) {
    return remote(loadFile(path, options));
}

/**
 * Saves a file on the server at the given path.
 * @param path The path of the file.
 * @param options The options.
 */
function serverSaveFile(path: string, data: string, options?: SaveFileOptions) {
    return remote(saveFile(path, data, options));
}

/**
 * subrtacts the given diff from the given bot.
 * @param bot The bot.
 * @param diff The diff to apply.
 */
function subtractMods(bot: any, ...diffs: Mod[]) {
    let subtractedDiffs: BotTags[] = [];
    diffs.forEach(diff => {
        if (!diff) {
            return;
        }
        let tags: BotTags;
        if (isBot(diff)) {
            tags = diff.tags;
        } else {
            tags = diff;
        }
        subtractedDiffs.push(tags);
        for (let key in tags) {
            setTag(bot, key, null);
        }
    });
}

/**
 * Shows a toast message to the user.
 * @param message The message to show.
 * @param duration The number of seconds the message should be on the screen. (Defaults to 2)
 */
function toast(message: string, duration: number = 2) {
    const event = toastMessage(message, duration);
    return addAction(event);
}

/**
 *   Play given url's audio
 * @example
 * // Send the player to the "welcome" dimension.
 * player.playSound("https://freesound.org/data/previews/58/58277_634166-lq.mp3");
 */
function playSound(url: string) {
    const event = calcPlaySound(url);
    return addAction(event);
}

/**
 * Shows some HTML to the user.
 * @param html The HTML to show.
 */
function showHtml(html: string) {
    const event = htmlMessage(html);
    return addAction(event);
}

/**
 * Hides the HTML from the user.
 */
function hideHtml() {
    const event = hideHtmlMessage();
    return addAction(event);
}

/**
 * Tweens the user's camera to view the given bot.
 * @param bot The bot to view.
 * @param zoomValue The zoom value to use.
 */
function tweenTo(
    bot: Bot | string,
    zoomValue?: number,
    rotX?: number,
    rotY?: number,
    duration?: number
) {
    const event = calcTweenTo(getID(bot), zoomValue, rotX, rotY, duration);
    return addAction(event);
}

/**
 * Instantly moves the user's camera to view the given bot.
 * @param bot The bot to view.
 * @param zoomValue The zoom value to use.
 * @param rotX The X rotation.
 * @param rotY The Y rotation.
 */
function moveTo(
    bot: Bot | string,
    zoomValue?: number,
    rotX?: number,
    rotY?: number
) {
    return tweenTo(bot, zoomValue, rotX, rotY, 0);
}

/**
 * Opens the QR Code Scanner.
 * @param camera The camera that should be used.
 */
function openQRCodeScanner(camera?: CameraType) {
    const event = calcOpenQRCodeScanner(true, camera);
    return addAction(event);
}

/**
 * Closes the QR Code Scanner.
 */
function closeQRCodeScanner() {
    const event = calcOpenQRCodeScanner(false);
    return addAction(event);
}

/**
 * Shows the given QR Code.
 * @param code The code to show.
 */
function showQRCode(code: string) {
    const event = calcShowQRCode(true, code);
    return addAction(event);
}

/**
 * Hides the QR Code.
 */
function hideQRCode() {
    const event = calcShowQRCode(false);
    return addAction(event);
}

/**
 * Opens the barcode scanner.
 * @param camera The camera that should be used.
 */
function openBarcodeScanner(camera?: CameraType) {
    const event = calcOpenBarcodeScanner(true, camera);
    return addAction(event);
}

/**
 * Closes the barcode scanner.
 */
function closeBarcodeScanner() {
    const event = calcOpenBarcodeScanner(false);
    return addAction(event);
}

/**
 * Shows the given barcode.
 * @param code The code that should be shown.
 * @param format The format that the barcode should be shown in.
 */
function showBarcode(code: string, format?: BarcodeFormat) {
    const event = calcShowBarcode(true, code, format);
    return addAction(event);
}

/**
 * Hides the barcode.
 */
function hideBarcode() {
    const event = calcShowBarcode(false);
    return addAction(event);
}

/**
 * Shows the run bar.
 * @param prefill The inpux text that should be prefilled into the run bar's input box. (optional)
 */
function showChat(prefill?: string) {
    return addAction(calcShowRun(prefill));
}

/**
 * Hides the run bar.
 */
function hideChat() {
    return addAction(calcHideRun());
}

/**
 * Enqueues the given script to execute after this script is done running.
 * @param script The script that should be executed.
 */
function run(script: string) {
    return addAction(runScript(script));
}

/**
 * Downloads the given list of bots.
 * @param bots The bots that should be downloaded.
 * @param filename The name of the file that the bots should be downloaded as.
 */
function downloadBots(bots: Bot[], filename: string) {
    let state: BotsState = {};
    for (let bot of bots) {
        state[bot.id] = bot;
    }
    return addAction(
        download(
            JSON.stringify(state),
            formatAuxFilename(filename),
            'application/json'
        )
    );
}

function formatAuxFilename(filename: string): string {
    if (filename.endsWith('.aux')) {
        return filename;
    }
    return filename + '.aux';
}

function downloadUniverse() {
    const state = getBotState();
    return addAction(
        download(
            JSON.stringify(state),
            `${getCurrentUniverse()}.aux`,
            'application/json'
        )
    );
}

/**
 * Shows the "Upload Universe" dialog.
 */
function showUploadAuxFile() {
    return addAction(calcShowUploadAuxFile());
}

/**
 * Loads the universe with the given ID.
 * @param id The ID of the universe to load.
 */
function loadUniverse(id: string) {
    const event = calcLoadSimulation(id);
    return addAction(event);
}

/**
 * Unloads the universe with the given ID.
 * @param id The ID of the universe to unload.
 */
function unloadUniverse(id: string) {
    const event = calcUnloadSimulation(id);
    return addAction(event);
}

/**
 * Imports the AUX at the given URL.
 * @param url The URL to load.
 */
function importAUX(url: string) {
    const event = calcImportAUX(url);
    return addAction(event);
}

/**
 * Sends a "hello" event to the server.
 */
function sayHello() {
    let actions = getActions();
    actions.push(calcRemote(calcSayHello()));
}

/**
 * Sends an echo event to the server.
 * @param message The message to send to the server.
 */
function echo(message: string) {
    let actions = getActions();
    actions.push(calcRemote(calcEcho(message)));
}

function unwrapBotOrMod(botOrMod: Mod) {
    if (isScriptBot(botOrMod)) {
        const calc = getCalculationContext();
        return calc.sandbox.interface.unwrapBot(botOrMod);
    } else {
        return botOrMod;
    }
}

/**
 * Sends an event to the server to setup a new universe if it does not exist.
 * @param universe The universe.
 * @param botOrMod The bot or mod that should be cloned into the new universe.
 */
function setupUniverse(universe: string, botOrMod?: Mod) {
    return remote(calcSetupChannel(universe, unwrapBotOrMod(botOrMod)));
}

/**
 * Executes the given shell script on the server.
 * @param script The shell script  that should be executed.
 */
function shell(script: string) {
    let actions = getActions();
    actions.push(calcRemote(calcShell(script)));
}

/**
 * Backs up all the AUX universes to a Github Gist.
 * @param auth The Github Personal Access Token that should be used to grant access to your Github account. See https://help.github.com/en/articles/creating-a-personal-access-token-for-the-command-line
 */
function backupToGithub(auth: string) {
    let actions = getActions();
    actions.push(calcRemote(calcBackupToGithub(auth)));
}

/**
 * Backs up all the AUX universes to a zip bot.
 */
function backupAsDownload(target: SessionSelector) {
    let actions = getActions();
    actions.push(
        calcRemote(calcBackupAsDownload(convertSessionSelector(target)))
    );
}

/**
 * Instructs auxPlayer to open the built-in developer console.
 * The dev console provides easy access to error messages and debug logs for formulas and actions.
 */
function openDevConsole() {
    const event = calcOpenConsole();
    return addAction(event);
}

/**
 * Determines if the user is currently connected to the server.
 */
function isConnected(): boolean {
    const user = getUser();
    if (user) {
        const val = getTag(user, 'aux.connected');
        if (val) {
            return val.valueOf() || false;
        }
    }
    return false;
}

/**
 * Changes the state that the given bot is in.
 * @param bot The bot to change.
 * @param stateName The state that the bot should move to.
 * @param groupName The group of states that the bot's state should change in. (Defaults to "state")
 */
function changeState(bot: Bot, stateName: string, groupName: string = 'state') {
    const previousState = getTag(bot, groupName);
    if (previousState === stateName) {
        return;
    }
    setTag(bot, groupName, stateName);

    const arg = {
        to: stateName,
        from: previousState,
    };
    if (hasValue(previousState)) {
        whisper(bot, `${groupName}${previousState}OnExit`, arg);
    }
    whisper(bot, `${groupName}${stateName}OnEnter`, arg);
}

function __energyCheck() {
    let current = getEnergy();
    current -= 1;
    setEnergy(current);
    if (current <= 0) {
        throw new Error('Ran out of energy');
    }
}

// NOTE: Make sure to add functions that don't
// match their exported name here so that builtin code editors can figure out what they are.
export const typeDefinitionMap = new Map([['player.getBot', 'getUser']]);

/**
 * Defines a set of functions that relate to common player operations.
 */
const player = {
    isInDimension,
    goToDimension,
    goToURL,
    openURL,
    getBot: getUser,
    getMenuDimension,
    getInventoryDimension,
    playSound,
    toast,
    showHtml,
    hideHtml,
    tweenTo,
    moveTo,
    openQRCodeScanner,
    closeQRCodeScanner,
    openBarcodeScanner,
    closeBarcodeScanner,
    showBarcode,
    hideBarcode,
    loadUniverse,
    unloadUniverse,
    importAUX,
    hasBotInInventory,
    showQRCode,
    hideQRCode,
    isConnected,
    getCurrentDimension,
    getCurrentUniverse,
    showInputForTag,
    checkout,
    replaceDragBot,
    setClipboard,
    showChat,
    hideChat,
    run,
    downloadBots,
    showUploadAuxFile,
    downloadUniverse,

    openDevConsole,
};

const server = {
    sayHello,
    shell,
    echo,
    backupToGithub,
    backupAsDownload,
    finishCheckout,

    loadFile: serverLoadFile,
    saveFile: serverSaveFile,
    setupUniverse,
};

/**
 * Defines a set of functions that relate to common math operations.
 */
const math = {
    sum,
    avg,
    sqrt,
    abs,
    stdDev,
    randomInt,
    random,
};

/**
 * Defines a set of functions that handle actions.
 */
const actionNamespace = {
    reject,
    perform,
};

export default {
    // Namespaces
    math,
    player,
    server,
    action: actionNamespace,

    // Global functions
    create,
    byCreator,
    destroy,
    shout,
    superShout,
    whisper,
    remote,
    webhook,
    getID,
    getJSON,
    changeState,

    // Mod functions
    applyMod,
    getMod,
    subtractMods,

    // Get bot functions
    getBot,
    getBots,
    getBotTagValues,
    byTag,
    byMod,
    inDimension,
    inStack,
    bySpace,
    atPosition,
    neighboring,
    either,
    not,

    // other util functions
    getTag,
    setTag,
    removeTags,
    renameTagsFromDotCaseToCamelCase,

    // Engine functions
    __energyCheck,
};
