import { Locator } from '@playwright/test';
import { dropFiles } from '../helpers/dragAndDrop.helper';

/**
 * Widgets - the blocks of markup the Angular client renders on more than one
 * screen.
 *
 * Each factory takes the root locator of one occurrence and returns a
 * descriptor whose fields are locators scoped to that root. Pages store those
 * descriptors in variables exactly like plain locators, which keeps the shared
 * markup described once instead of once per page:
 *
 *   offer card    -> Offers, Lists, Profile, MemberProfile
 *   member panel  -> Profile, MemberProfile, EditProfile
 *   tabset        -> Profile, MemberProfile, EditProfile, Admin
 *   post form     -> AddOffer, EditOffer
 *   file uploader -> AddOffer, EditProfile
 *   login form    -> Login, navigation bar
 *   validated field -> Registration, AddOffer, EditOffer
 */

/** The `data-testid` spelling of a camelCase name, e.g. `minPriceLocalTrans` -> `min-price-local-trans`. */
function testIdOf(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

// ---------------------------------------------------------------- login form

export interface LoginFormWidget {
  root: Locator;
  usernameInput: Locator;
  passwordInput: Locator;
  /** Eye button flipping the password field between `password` and `text`. */
  togglePasswordButton: Locator;
  submitButton: Locator;
  login(username: string, password: string): Promise<void>;
}

/**
 * `form.login-form` - byte-for-byte the same markup in the navigation bar and
 * on the login page. Both render `id="password"`, so the id is duplicated in
 * the DOM whenever a signed-out visitor is on `/`; every locator below is
 * scoped to the form root and keys on `name`. (The bar's copy also carries
 * `nav-login-*` test ids, which `BasePage` uses.)
 */
export function loginForm(root: Locator): LoginFormWidget {
  const usernameInput = root.locator('input[name="username"]');
  const passwordInput = root.locator('input[name="password"]');
  const submitButton = root.locator('button.login-btn');

  return {
    root,
    usernameInput,
    passwordInput,
    togglePasswordButton: root.locator('.btn-eye'),
    submitButton,
    async login(username, password) {
      await usernameInput.fill(username);
      await passwordInput.fill(password);
      await submitButton.click();
    },
  };
}

// ------------------------------------------------------------ validated field

export interface FieldWidget {
  root: Locator;
  /** The editable element - `input` for most fields, `textarea` for descriptions. */
  control: Locator;
  errorIcon: Locator;
  /** All validation messages rendered under the control. */
  errors: Locator;
  error(text: string | RegExp): Locator;
  fill(value: string): Promise<void>;
  clear(): Promise<void>;
  value(): Promise<string>;
  isInvalid(): Promise<boolean>;
}

/**
 * One control produced by the shared Angular wrappers (`app-text-input`,
 * `app-text-input-post`, `app-number-input-post`, `app-text-textarea-post`,
 * `app-date-picker`). They all render the same skeleton:
 *
 *   <div class="single-input">
 *     <input class="…-input" [class.is-invalid]>
 *     <i class="error-icon">
 *     <div class="invalid-feedback">Please enter a {{label}}</div>
 *   </div>
 *
 * `root` is anything around one such skeleton - the wrapper's host element
 * (`post-form-*` test ids) or the `.single-input` itself.
 */
export function field(root: Locator): FieldWidget {
  const control = root.locator('input, textarea, select').first();
  const errors = root.locator('.invalid-feedback');

  return {
    root,
    control,
    errors,
    errorIcon: root.locator('.error-icon'),
    error: (text) => errors.filter({ hasText: text }),
    fill: (value) => control.fill(value),
    clear: () => control.fill(''),
    value: () => control.inputValue(),
    isInvalid: () => control.evaluate((el) => el.classList.contains('is-invalid')),
  };
}

/**
 * Locates a field by the placeholder of its control - for the forms without
 * test ids (registration). The wrappers copy `[label]` / `[placeholder]` onto
 * the native input, and matching is exact so `Password` never resolves to
 * `Confirm Password`.
 */
export function fieldByPlaceholder(scope: Locator, placeholder: string): FieldWidget {
  return field(
    scope.locator('.single-input').filter({
      has: scope.page().getByPlaceholder(placeholder, { exact: true }),
    })
  );
}

// ----------------------------------------------------------------- offer card

/**
 * The like icon's computed colour - the templates bind
 * `[style.color]="hasLiked() ? 'red' : 'black'"`. Specs assert on it with
 * `toHaveCSS('color', LIKE_COLOR.liked)` rather than spelling the colour out.
 */
export const LIKE_COLOR = {
  liked: 'rgb(255, 0, 0)',
  notLiked: 'rgb(0, 0, 0)',
} as const;

export interface OfferCardWidget {
  root: Locator;
  photo: Locator;
  /** `Country, City` badge drawn over the photo. */
  location: Locator;
  title: Locator;
  /** Present on `app-offer-card` only. */
  owner: Locator;
  ownerName: Locator;
  ownerAvatar: Locator;
  /** `.is-online`, driven by the SignalR presence hub. */
  onlineBadge: Locator;
  /** Present on `app-offer-card` and `app-member-offer-card`. */
  likeIcon: Locator;
  /** Present on `app-member-profile-offer-card` only. */
  editIcon: Locator;
  deleteIcon: Locator;
  /** Opens `/offers/{id}`. */
  openDetails(): Promise<void>;
  /** Opens `/members/{username}`. */
  openOwner(): Promise<void>;
  toggleLike(): Promise<void>;
  /** The template binds `[style.color]="hasLiked() ? 'red' : 'black'"`. */
  isLiked(): Promise<boolean>;
}

/**
 * The post card, in its three flavours. `app-offer-card`,
 * `app-member-offer-card` and `app-member-profile-offer-card` carry the same
 * `offer-card-*` test ids and differ only in which icons they render - hence one
 * descriptor with every locator, of which a given flavour resolves the subset
 * its template renders. `root` is the `offer-card` element.
 */
export function offerCard(root: Locator): OfferCardWidget {
  const photo = root.getByTestId('offer-card-photo');
  const owner = root.getByTestId('offer-card-owner');
  const likeIcon = root.getByTestId('offer-card-like');

  return {
    root,
    photo,
    owner,
    likeIcon,
    location: root.getByTestId('offer-card-location'),
    title: root.getByTestId('offer-card-title'),
    ownerName: root.getByTestId('offer-card-owner-name'),
    ownerAvatar: root.getByTestId('offer-card-owner-avatar'),
    // A state rather than an element: the template toggles the class on the avatar's wrapper.
    onlineBadge: owner.locator('.is-online'),
    editIcon: root.getByTestId('offer-card-edit'),
    deleteIcon: root.getByTestId('offer-card-delete'),
    openDetails: () => photo.click(),
    openOwner: () => owner.click(),
    toggleLike: () => likeIcon.click(),
    async isLiked() {
      const color = await likeIcon.evaluate((el) => getComputedStyle(el).color);
      return color === LIKE_COLOR.liked;
    },
  };
}

// -------------------------------------------------------------- member panel

export type MemberInfoLabel = 'Location' | 'Age' | 'Last Active' | 'Member Since';

export interface MemberSidebarWidget {
  root: Locator;
  photo: Locator;
  infoRows: Locator;
  location: Locator;
  age: Locator;
  lastActive: Locator;
  memberSince: Locator;
  /** Green `Online` marker - member detail only. */
  onlineIndicator: Locator;
  /** Member detail and own profile. */
  messageButton: Locator;
  /** Own profile only - navigates to `/member/edit-profile`. */
  editProfileButton: Locator;
  /** Edit profile only - disabled until the form becomes dirty. */
  saveChangesButton: Locator;
  infoValue(label: MemberInfoLabel): Locator;
}

/** `.left-side` - the member summary panel of the three member screens. */
export function memberSidebar(root: Locator): MemberSidebarWidget {
  const infoRows = root.locator('.info');
  const infoValue = (label: MemberInfoLabel) =>
    infoRows.filter({ hasText: `${label}:` }).locator('p');

  return {
    root,
    infoRows,
    infoValue,
    photo: root.locator('img[alt="User\'s photo"]'),
    location: infoValue('Location'),
    age: infoValue('Age'),
    lastActive: infoValue('Last Active'),
    memberSince: infoValue('Member Since'),
    onlineIndicator: infoRows.locator('i.fa-user'),
    messageButton: root.locator('button.message-button'),
    editProfileButton: root.locator('button.edit-profile-button'),
    saveChangesButton: root.locator('button.save-button'),
  };
}

// -------------------------------------------------------------------- tabset

export interface TabsetWidget {
  root: Locator;
  headers: Locator;
  activeHeader: Locator;
  /** Body of the tab that is currently open. */
  activeContent: Locator;
  header(heading: string | RegExp): Locator;
  open(heading: string | RegExp): Promise<void>;
  headings(): Promise<string[]>;
}

/**
 * ngx-bootstrap `<tabset>`:
 *
 *   <ul class="nav nav-tabs"><li><a class="nav-link [active]">Heading</a></li></ul>
 *   <div class="tab-content"><tab class="tab-pane [active]">…</tab></div>
 *
 * Headings are interpolated in the templates (`About {{member.knownAs}}`), so
 * every lookup accepts a RegExp as well as a string.
 */
export function tabset(root: Locator): TabsetWidget {
  const headers = root.locator('.nav-tabs .nav-link');
  const activeHeader = root.locator('.nav-tabs .nav-link.active');
  const header = (heading: string | RegExp) => headers.filter({ hasText: heading });

  return {
    root,
    headers,
    activeHeader,
    header,
    activeContent: root.locator('.tab-content .tab-pane.active'),
    async open(heading) {
      await header(heading).click();
      await activeHeader.filter({ hasText: heading }).waitFor({ state: 'visible' });
    },
    headings: () => headers.allInnerTexts(),
  };
}

// ------------------------------------------------------------- file uploader

export interface FileUploaderWidget {
  root: Locator;
  dropZone: Locator;
  /** The `<input type="file">` ng2FileDrop attaches to the drop zone. */
  fileInput: Locator;
  queueLength: Locator;
  queueRows: Locator;
  progressBar: Locator;
  uploadAllButton: Locator;
  cancelAllButton: Locator;
  removeAllButton: Locator;
  /** Only works if the zone renders a backing `<input type="file">` - see `dropFiles`. */
  selectFiles(...files: string[]): Promise<void>;
  /**
   * Simulates an HTML5 file drop onto `dropZone`. `[ng2FileDrop]` only ever
   * listens for the native `drop` event (`add-offer.component.html`,
   * `photo-editor.component.html` - neither renders an `<input>`), so this is
   * the only way to queue a file on either screen; `selectFiles` has nothing
   * to target there.
   */
  dropFiles(...files: string[]): Promise<void>;
  queuedFileNames(): Promise<string[]>;
}

/**
 * The ng2-file-upload drop zone (`file-drop-zone`) and queue. `add-offer`
 * renders only "Remove all"; `photo-editor` renders all three buttons.
 */
export function fileUploader(root: Locator): FileUploaderWidget {
  const fileInput = root.locator('input[type="file"]');
  const dropZone = root.getByTestId('file-drop-zone');
  const queueRows = root.locator('table.table tbody tr');

  return {
    root,
    fileInput,
    queueRows,
    dropZone,
    queueLength: root.getByText(/Queue length:/),
    progressBar: root.locator('.progress .progress-bar'),
    uploadAllButton: root.getByRole('button', { name: 'Upload all' }),
    cancelAllButton: root.getByRole('button', { name: 'Cancel all' }),
    removeAllButton: root.getByRole('button', { name: 'Remove all' }),
    selectFiles: (...files) => fileInput.setInputFiles(files),
    dropFiles: (...files) => dropFiles(dropZone, ...files),
    queuedFileNames: () => queueRows.locator('td strong').allInnerTexts(),
  };
}

// ----------------------------------------------------------------- post form

/** Checkboxes that reveal an extra block of price fields. */
export type PostToggle =
  | 'localTransport'
  | 'entranceFee'
  | 'placeStay'
  | 'groceryStore'
  | 'guide';

export type AccommodationType = 'Camping' | 'Hotel' | 'Hostel';

/** Fields `add-offer.component.ts` marks `Validators.required` - `Share post` stays disabled without any of them. */
export const REQUIRED_POST_FIELDS = [
  'title',
  'locationCountry',
  'locationCity',
  'lastCountry',
  'lastRegion',
  'currency',
] as const;

export type RequiredPostField = (typeof REQUIRED_POST_FIELDS)[number];

export interface PostFormData {
  title?: string;
  locationCountry?: string;
  locationCity?: string;
  lastCountry?: string;
  lastRegion?: string;
  currency?: string;
  description?: string;
  localTransport?: { minPrice: string; maxPrice: string; travelTime: string };
  entranceFee?: { minPrice: string; maxPrice: string };
  placeStay?: { minPrice: string; maxPrice: string; type: AccommodationType };
  groceryStore?: { minPrice: string; maxPrice: string };
  guide?: { minPrice: string; maxPrice: string };
}

export interface PostFormWidget {
  root: Locator;

  title: FieldWidget;
  locationCountry: FieldWidget;
  locationCity: FieldWidget;
  lastCountry: FieldWidget;
  lastRegion: FieldWidget;
  currency: FieldWidget;
  description: FieldWidget;

  minPriceLocalTransport: FieldWidget;
  maxPriceLocalTransport: FieldWidget;
  travelTime: FieldWidget;
  minPriceEntranceFee: FieldWidget;
  maxPriceEntranceFee: FieldWidget;
  minPricePlaceStay: FieldWidget;
  maxPricePlaceStay: FieldWidget;
  accommodationTypeSelect: Locator;
  minPriceGroceryStore: FieldWidget;
  maxPriceGroceryStore: FieldWidget;
  minPriceGuide: FieldWidget;
  maxPriceGuide: FieldWidget;

  /** `Share post` on `add-offer`, `Edit post` on `edit-offer`. */
  submitButton: Locator;

  checkbox(toggle: PostToggle): Locator;
  /** Clickable label wrapping the visually hidden checkbox. */
  checkboxControl(toggle: PostToggle): Locator;
  /** The question rendered next to the checkbox. */
  checkboxLabel(toggle: PostToggle): Locator;
  isToggled(toggle: PostToggle): Promise<boolean>;
  setToggle(toggle: PostToggle, value: boolean): Promise<void>;

  /** Fills only the keys present in `data`; a price section implies its checkbox. */
  fill(data: PostFormData): Promise<void>;
  submit(): Promise<void>;
}

/**
 * The travel-post form. `add-offer` and `edit-offer` render a copy of the same
 * template and carry the same test ids, so `root` - the `post-form` element - is
 * all a page supplies:
 *
 *   post-form-{formControlName}       a field's wrapper, e.g. post-form-min-price-local-trans
 *   post-form-toggle-{name}           the clickable label around a checkbox
 *   post-form-toggle-{name}-label     the question next to it
 *   post-form-type-place-stay         the accommodation select
 *   post-form-submit
 *
 * The native checkbox is `opacity: 0` and covered by `span.checkmark`, so the
 * wrapping label is clicked and the state is read back from the input.
 */
export function postForm(root: Locator): PostFormWidget {
  const control = (formControlName: string) => field(root.getByTestId(`post-form-${testIdOf(formControlName)}`));

  const checkboxControl = (toggle: PostToggle) => root.getByTestId(`post-form-toggle-${testIdOf(toggle)}`);

  const checkbox = (toggle: PostToggle) => checkboxControl(toggle).getByRole('checkbox');

  const isToggled = (toggle: PostToggle) => checkbox(toggle).isChecked();

  const setToggle = async (toggle: PostToggle, value: boolean) => {
    if ((await isToggled(toggle)) !== value) {
      await checkboxControl(toggle).click();
    }
  };

  const widget: PostFormWidget = {
    root,

    title: control('title'),
    locationCountry: control('locationCountry'),
    locationCity: control('locationCity'),
    lastCountry: control('lastCountry'),
    lastRegion: control('lastRegion'),
    currency: control('currency'),
    description: control('description'),

    minPriceLocalTransport: control('minPriceLocalTrans'),
    maxPriceLocalTransport: control('maxPriceLocalTrans'),
    travelTime: control('travelTime'),
    minPriceEntranceFee: control('minPriceEntrFee'),
    maxPriceEntranceFee: control('maxPriceEntrFee'),
    minPricePlaceStay: control('minPricePlaceStay'),
    maxPricePlaceStay: control('maxPricePlaceStay'),
    accommodationTypeSelect: root.getByTestId('post-form-type-place-stay'),
    minPriceGroceryStore: control('minPriceGroceryStore'),
    maxPriceGroceryStore: control('maxPriceGroceryStore'),
    minPriceGuide: control('minPriceGuide'),
    maxPriceGuide: control('maxPriceGuide'),

    submitButton: root.getByTestId('post-form-submit'),

    checkbox,
    checkboxControl,
    checkboxLabel: (toggle) => root.getByTestId(`post-form-toggle-${testIdOf(toggle)}-label`),
    isToggled,
    setToggle,

    async fill(data) {
      const fillIf = async (target: FieldWidget, value?: string) => {
        if (value !== undefined) await target.fill(value);
      };

      await fillIf(widget.title, data.title);
      await fillIf(widget.locationCountry, data.locationCountry);
      await fillIf(widget.locationCity, data.locationCity);
      await fillIf(widget.lastCountry, data.lastCountry);
      await fillIf(widget.lastRegion, data.lastRegion);

      if (data.localTransport) {
        await setToggle('localTransport', true);
        await widget.minPriceLocalTransport.fill(data.localTransport.minPrice);
        await widget.maxPriceLocalTransport.fill(data.localTransport.maxPrice);
        await widget.travelTime.fill(data.localTransport.travelTime);
      }

      if (data.entranceFee) {
        await setToggle('entranceFee', true);
        await widget.minPriceEntranceFee.fill(data.entranceFee.minPrice);
        await widget.maxPriceEntranceFee.fill(data.entranceFee.maxPrice);
      }

      if (data.placeStay) {
        await setToggle('placeStay', true);
        await widget.minPricePlaceStay.fill(data.placeStay.minPrice);
        await widget.maxPricePlaceStay.fill(data.placeStay.maxPrice);
        await widget.accommodationTypeSelect.selectOption(data.placeStay.type);
      }

      if (data.groceryStore) {
        await setToggle('groceryStore', true);
        await widget.minPriceGroceryStore.fill(data.groceryStore.minPrice);
        await widget.maxPriceGroceryStore.fill(data.groceryStore.maxPrice);
      }

      if (data.guide) {
        await setToggle('guide', true);
        await widget.minPriceGuide.fill(data.guide.minPrice);
        await widget.maxPriceGuide.fill(data.guide.maxPrice);
      }

      await fillIf(widget.currency, data.currency);
      await fillIf(widget.description, data.description);
    },

    submit: () => widget.submitButton.click(),
  };

  return widget;
}
