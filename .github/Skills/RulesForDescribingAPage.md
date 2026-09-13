# Page Object Model — EW TravelApp (Angular 17 client)

One file = one page. Each file describes a single screen of the application:
**locators live in variables, methods describe the widgets, sections and actions
of that screen.** No assertions and no test data here — those belong in
`specs/`.

## Layout

```
src/PageObjects/
├── BasePage.ts            infrastructure: routing, waiting, nav bar, toasts
├── widgets.ts             blocks of markup shared by several pages
├── index.ts               barrel — specs import from here
│
├── Auth/
│   ├── Login/Login.page.ts                  /
│   └── Registration/Registration.page.ts    register form inside /
├── Offers/
│   ├── Offers.page.ts                       /offers
│   ├── OfferDetails/OfferDetails.page.ts    /offers/:id
│   ├── AddOffer/AddOffer.page.ts            /add-offer
│   └── EditOffer/EditOffer.page.ts          /edit-offer/:id
├── Profile/
│   ├── Profile.page.ts                      /member/profile      (own profile)
│   ├── MemberProfile/MemberProfile.page.ts  /members/:username   (someone else)
│   └── EditProfile/EditProfile.page.ts      /member/edit-profile
├── Lists/Lists.page.ts       /lists
├── Messages/Messages.page.ts /messages
├── Admin/Admin.page.ts       /admin
└── Errors/
    ├── TestErrors/TestErrors.page.ts    /errors
    ├── NotFound/NotFound.page.ts        /not-found  (+ wildcard)
    └── ServerError/ServerError.page.ts  /server-error
```

All 14 routes from `Client/src/app/app.routes.ts` are covered.

## File and folder naming

**A page file always lives in a folder that carries its own name.** The folder is
the page's home: anything that belongs to that page only — future fixtures,
page-local widgets, screenshots — goes next to it instead of leaking into a
shared directory.

```
Lists/Lists.page.ts                 ✔  folder name == file name
Offers/AddOffer/AddOffer.page.ts    ✔  page folder nested inside its feature folder
Offers/AddOffer.page.ts             ✘  page file loose in the feature folder
Pages/Lists.page.ts                 ✘  page file with no folder of its own
```

Rules that follow from it:

1. Folder and class use the same PascalCase stem; the file adds `.page.ts` and
   the class adds the `Page` suffix — `AddOffer/AddOffer.page.ts` exports
   `AddOfferPage`.
2. When a feature folder already carries the page's name, the page file sits
   directly in it — `Offers/Offers.page.ts`, not `Offers/Offers/Offers.page.ts`.
3. Feature folders (`Auth/`, `Offers/`, `Profile/`, `Errors/`) group related
   pages; they never hold a page file whose name differs from the folder.
4. The exception is infrastructure — `BasePage.ts`, `widgets.ts` and `index.ts`
   are not pages and stay flat at the root of `Pages/`.

## Anatomy of a page file

```ts
export class OffersPage extends BasePage {
  readonly path = 'offers';                  // route

  // ---- locators ----
  readonly root: Locator;
  readonly heading: Locator;
  readonly emptyState: Locator;
  readonly cards: Locator;
  readonly uniqueElement: Locator;           // proof the page rendered

  constructor(page: Page) { … }

  // ---- widgets / sections ----
  card(title: string): OfferCardWidget { … }
  cardAt(index: number): OfferCardWidget { … }

  // ---- actions / queries ----
  titles(): Promise<string[]> { … }
  isEmpty(): Promise<boolean> { … }
}
```

A page supplies only `path` and `uniqueElement`; `open()`, `navigate()`,
`waitForLoaded()`, `reload()`, `isOpen()`, the whole navigation bar and the
toast helpers come from `BasePage` (Template Method).

`RegistrationPage` is the one page with no route of its own — the register form
is a mode of the login component — so it overrides `open()` to load `/` and
click "Register".

## `widgets.ts` — where duplication goes to die

The Angular client repeats several blocks of markup verbatim. Instead of
restating those locators in every page file, a widget factory takes the root
locator of one occurrence and returns a descriptor scoped to it. Pages store the
result in a variable, exactly like a locator.

| Widget | Factory | Used by |
| --- | --- | --- |
| Post card (3 flavours) | `offerCard(root)` | Offers, Lists, Profile, MemberProfile |
| Member summary panel | `memberSidebar(root)` | Profile, MemberProfile, EditProfile |
| ngx-bootstrap tabset | `tabset(root)` | Profile, MemberProfile, EditProfile, Admin |
| Travel-post form | `postForm(root, 'add' \| 'edit')` | AddOffer, EditOffer |
| ng2-file-upload zone | `fileUploader(root)` | AddOffer, EditProfile |
| Quick login form | `loginForm(root)` | Login, navigation bar |
| Validated control | `field` / `fieldByPlaceholder` | Registration, AddOffer, EditOffer |

The biggest win is `postForm`: `add-offer.component.html` and
`edit-offer.component.html` are ~200 lines of identical template carrying the
same `post-form-*` test ids, so both pages share one descriptor.

`OffersPage` and `ListsPage` deliberately restate their three container locators
rather than sharing a base class — the card internals (the part that actually
repeats) are in `offerCard`, and keeping the containers local means each page
file still reads on its own.

## Locator strategy

The screens the suite leans on most carry **`data-testid` hooks** (see *Test ids
in the client* below). Preference order:

1. **`data-testid`** and **role + accessible name**, side by side at the top:
   `getByTestId('offer-card-like')` for an element the application gives no
   accessible name or role to (an icon, a table cell, a layout block),
   `getByRole('button', { name: 'Submit' })` for anything a user would name.
2. **Exact placeholder** — the shared `app-text-input*` wrappers copy `[label]`
   / `[placeholder]` onto the native input. Matching is `{ exact: true }` so
   `Password` never resolves to `Confirm Password`.
3. **Static attributes** such as `name` — present in the DOM as written in the
   template.
4. **Angular element selectors** (`app-offers-list`, `app-member-messages`) as
   page roots.
5. **CSS classes** as a last resort, always scoped to a root — and for a *state*
   the application expresses only as a class (`.is-online`, `.active`,
   `.btn-active`).

### Test ids in the client

`kebab-case`, `<component>-<element>`. Playwright's `testIdAttribute` is
`data-testid` by default, so `playwright.config.ts` sets nothing.

| Template | Test ids | Used by |
| --- | --- | --- |
| `nav` | `nav`, `nav-brand`, `nav-link`, `nav-avatar`, `nav-user-menu-toggle`, `nav-user-menu`, `nav-login-form`, `nav-login-username`, `nav-login-password`, `nav-login-submit` | `BasePage` |
| the three post cards | `offer-card`, `offer-card-photo`, `offer-card-location`, `offer-card-title`, `offer-card-owner`, `offer-card-owner-name`, `offer-card-owner-avatar`, `offer-card-like`, `offer-card-edit`, `offer-card-delete` | `offerCard`; Offers, Lists, Profile, MemberProfile |
| `add-offer`, `edit-offer` | `post-form`, `post-form-{formControlName}` (e.g. `post-form-min-price-local-trans`), `post-form-toggle-{name}`, `post-form-toggle-{name}-label`, `post-form-type-place-stay`, `post-form-submit`; `add-offer-photo` | `postForm`; AddOffer, EditOffer |
| `offer-detail` | `offer-detail`, `offer-detail-photo`, `-location`, `-owner`, `-owner-name`, `-owner-avatar`, `-like`, `-place`, `-last-visited`, `-description`, and one per optional section: `offer-detail-local-transport`, `-entrance-fee`, `-place-stay`, `-grocery-store`, `-guide` | OfferDetails |
| `messages` | `messages-containers`, `messages-empty`, `messages-table`, `message-row`, `message-row-content`, `-counterpart`, `-avatar`, `-sent`, `-delete` | Messages |
| `photo-editor` | `photo-editor-photo`, `photo-editor-image`, `photo-editor-set-main`, `photo-editor-delete`; `file-drop-zone` (also on `add-offer`) | EditProfile, `fileUploader` |

A new hook goes into the template first and into a page object second; a spec
never calls `getByTestId` itself (`RulesForWritingTests.md` §1). A test id on a
wrapper component's host element (`<app-number-input-post data-testid="…">`)
stays in the DOM, so `field()` finds the control inside it.

Constraints found in the client and handled here:

- `nav.component.html` and `login.component.html` both render `form.login-form`
  **with a duplicated `id="password"`**, so on `/` the id exists twice. The bar is
  reached through its `nav-login-*` test ids; the login card, which has none yet,
  is scoped to its form root and keys on `name` (`loginPage.form`).
- The post-form checkboxes are `opacity: 0` and covered by `span.checkmark`, so
  `postForm` clicks the `post-form-toggle-*` label and reads the state back from
  the checkbox inside it instead of calling `check()`.
- The like state is observable only as `[style.color]` (`red` / `black`), so
  `isLiked()` compares the computed colour.
- Tab headings are interpolated (`About {{knownAs}}`), so tab lookups accept a
  `RegExp`.

> The login and registration forms, the admin panel, the member sidebar and
> message thread, and the error pages have no test ids yet: there, renaming a
> style class in the client can still break a locator.

## Configuration

`appUrl()` resolves the target from `BASE_URL`, defaulting to
`https://localhost:4200` — the Angular dev server runs over HTTPS
(`Client/angular.json` → `architect.serve.options.ssl`). Because that
certificate is self-signed, `playwright.config.ts` needs:

```ts
use: {
  ignoreHTTPSErrors: true,
  baseURL: process.env.BASE_URL ?? 'https://localhost:4200',
}
```

## Usage

```ts
import { LoginPage, OffersPage, ListsPage, AddOfferPage } from '../src/PageObjects';
import { expect, FIXTURES, test } from '../specs/support';

test('a liked post shows up on the Lists page', async ({ page }) => {
  const login = new LoginPage(page);
  await login.open();
  await login.login('lisa', 'Pa$$w0rd');

  const offers = await new OffersPage(page).waitForLoaded();
  const card = offers.firstCard();
  const title = await card.title.innerText();
  await card.toggleLike();

  const lists = await new ListsPage(page).open();
  await expect(lists.card(title).root).toBeVisible();
});

test('a new post is published', async ({ page }) => {
  const addOffer = await new AddOfferPage(page).open();

  await addOffer.attachPhoto(FIXTURES.photo);   // specs/fixtures/travel-photo.jpg
  await addOffer.publish({
    title: 'Morskie Oko',
    locationCountry: 'Poland',
    locationCity: 'Malopolska',
    lastCountry: 'Poland',
    lastRegion: 'Krakow',
    entranceFee: { minPrice: '10', maxPrice: '15' },
    placeStay: { minPrice: '80', maxPrice: '200', type: 'Hostel' },
    currency: 'PLN',
    description: 'Worth the hike.',
  });

  await expect(addOffer.successToast).toContainText('Post added successfully');
});
```

## Assertions stay in specs - page objects expose locators for them

A page object never asserts, but it gives specs something to assert *on*: every element whose state a test
checks is a `readonly` `Locator` field or a method returning a `Locator` - `section(name)`,
`messageWithText(text)`, `userRow(username).roles`. Specs then use retrying web-first matchers
(`RulesForWritingTests.md` §12):

```ts
await expect(registration.registerButton).toBeDisabled();   // ✔ retries until the state settles
expect(await registration.isSubmitEnabled()).toBe(false);    // ✘ reads the state once
```

Methods that return plain values - `isOpen()`, `isSubmitEnabled()`, `cardCount()`, `photo(i).isMain()`,
`isLiked()` - remain for **flow control inside page objects and helpers** (`firstCardNotOwnedBy`,
`mainPhotoIndex`), not for assertions. A visual state the application only encodes in a style gets a named
constant next to its widget, so a spec never spells a colour out: `LIKE_COLOR.liked` for the like icon.

## Conventions for a new page

1. Create `<Name>/<Name>.page.ts` — the file always gets a folder of its own,
   placed inside the matching feature folder when there is one
   (`Offers/AddOffer/AddOffer.page.ts`). See *File and folder naming*.
2. Extend `BasePage`; declare `path` and `uniqueElement`.
3. Declare every locator as a `readonly` field, assigned in the constructor and
   scoped to `root`.
4. Methods describe widgets/sections (`card(title)`, `section(name)`,
   `userRow(username)`), actions (`publish`, `save`) and queries (`titles`,
   `isEmpty`). Anything a spec asserts on is reachable as a `Locator`;
   value-returning queries are for flow control (see *Assertions stay in specs*).
5. If a block of markup appears on a second page, move it into `widgets.ts`
   rather than copying the locators.
6. Register the file in `index.ts`.
