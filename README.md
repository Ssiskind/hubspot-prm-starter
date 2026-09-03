# HubSpot PRM Starter Kit

A full-stack Partner Relationship Management (PRM) system for HubSpot—featuring deal registrations, MDF request tracking, partner tiering, and co-sell enablement.

## Architecture

```
Browser ──► Next.js Portal (partner-portal/)
            ▲                      │
            │                      ▼
HubSpot CRM UI ◄── UI Extensions ◄─ HubSpot CRM API
            (hubspot-project/)
```

## Prerequisites

- **Node.js** 20+
- A HubSpot portal account with developer access
- [**HubSpot Agent CLI**](https://developers.hubspot.com/docs/developer-tooling/local-development/agent-cli/guide) (`curl -fsSL https://api.hubapi.com/hub/cli/backend/hub-cli/latest/install.sh | sh`)
- **HubSpot Agent CLI Skills** (`npx skills add hubspot/agent-cli-skills`)
- [**HubSpot CLI**](https://developers.hubspot.com/docs/developer-tooling/local-development/hubspot-cli/install-the-cli) v7.6+ (`npm install -g @hubspot/cli@latest`)
- ~15 minutes for first-time setup

## HubSpot Account Setup

### 1. Clone this repo

```zsh
git clone https://github.com/Ssiskind/hubspot-prm-starter.git
cd hubspot-prm-starter
```

### 2. Create a developer test account

Follow [these instructions](https://developers.hubspot.com/docs/getting-started/account-types#create-a-developer-test-account) to create a developer test account within your main HubSpot account. 

### 3. Create a service key within the test account

Follow [these instructions](https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/account-service-keys) to generate a service key to use with this project. Save the service key into your .env.local file.

#### Scopes to include

```
crm.schemas.custom.write
crm.objects.contacts.write
crm.objects.contacts.read
cpq.price_books.write
crm.schemas.custom.read
crm.objects.deals.write
crm.objects.custom.read
crm.objects.companies.write
crm.objects.deals.read
tickets
crm.objects.custom.write
cpq.price_books.read
crm.objects.companies.read
```

#### Set up initial environment variables

```zsh
cd ./partner-portal
cp .env.local.example .env.local
```

Then edit `.env.local`:
- Paste the service key into `HUBSPOT_ACCESS_TOKEN`
- Set `DEMO_PASSWORD` to a whatever you desire
- Generate `AUTH_SECRET` with: `openssl rand -base64 32`

### 4. Create Properties in HubSpot via Agent CLI

Navigate back to the main directory and set up Agent CLI Auth

```zsh
cd ..
hubspot auth login
```

Choose the developer portal account that you configured in the earlier step. Select all permissions and click connect app.

Verify by using the whoami command

```zsh
hubspot whoami
```

#### Company Properties
```zsh
cat ./properties/company.jsonl | hubspot properties batch-create --type companies
```

#### Contact Properties
```zsh
cat ./properties/contact.jsonl | hubspot properties batch-create --type contacts
```

#### Deal Properties
    
```zsh
cat ./properties/deal.jsonl | hubspot properties batch-create --type deals
```

#### Ticket Properties

```zsh
cat ./properties/ticket.jsonl | hubspot properties batch-create --type tickets 
```

### 3. Enroll in Pricebooks API Beta
- You'll need access to this beta in order to having partner portal pricing defined by HubSpot. https://app.hubspot.com/l/product-updates/?rollout=310989

### 5. Create Custom Objects

#### Partner Program Enrollment
```zsh
hubspot schemas create --file ./schema/partner_program_enrollment.json
```
#### Deal Registration
```zsh
hubspot schemas create --file ./schema/deal_registration.json
```
#### MDF Request
```zsh
hubspot schemas create --file ./schema/mdf_request.json
```

#### Get Custom Object IDs

```zsh
hubspot objects types
```

From the response save the values of objectTypeId for the custom objects into your .env.local file. You'll need them in the next step.

### 6. Create Pipelines

- Partner Onboarding 

```zsh
HUBSPOT_ACCESS_TOKEN=YOUR_SERVICE_KEY hubspot pipelines create --type PARTNER_PROGRAM_ENROLLMENT_CUSTOM_OBJECT_ID < ./schema/pipeline_partner_onboarding.json
```

- Deal Registration

```zsh
HUBSPOT_ACCESS_TOKEN=YOUR_SERVICE_KEY hubspot pipelines create --type DEAL_REGISTRATION_CUSTOM_OBJECT_ID < ./schema/pipeline_deal_registration.json
```

- MDF Request

```zsh
HUBSPOT_ACCESS_TOKEN=YOUR_SERVICE_KEY hubspot pipelines create --type MDF_REQUEST_CUSTOM_OBJECT_ID < ./schema/pipeline_mdf_request.json
```

- Deal Conflict Resolution (ticket pipeline used when two partners register the same customer)

```zsh
HUBSPOT_ACCESS_TOKEN=YOUR_SERVICE_KEY hubspot pipelines create --type ticket < ./schema/pipeline_conflict_ticket.json
```

From the response, copy the pipeline `id` and the `id` of the first stage (label "New") into `.env.local`:

```
HUBSPOT_CONFLICT_TICKET_PIPELINE_ID=<pipeline id>
HUBSPOT_CONFLICT_TICKET_STAGE_NEW=<New stage id>
```

### 7. Create Products and Pricebooks

#### Create Products

```zsh
 cat products/products.jsonl | hubspot objects create --type products
```

#### Create Price Books

The partner portal loads products and pricing by partner tier. Each tier gets its own price book.

1. Settings → Commerce → Price Books
2. Click **Create price book**
3. Name it (e.g., "Platinum Partners")
4. Add products and pricing:
   - You'll need existing Products in HubSpot first (Products → Manage)
   - For each product: set the price and billing period (monthly, annual, etc.)

Repeat for Gold, Silver, and Registered tiers.

### Get Price Book IDs

1. Open each price book
2. Copy the ID from the URL (numeric)

**Save to `.env.local`:**
```
HUBSPOT_PRICE_BOOK_PLATINUM=PRICE_BOOK_ID
HUBSPOT_PRICE_BOOK_GOLD=PRICE_BOOK_ID
HUBSPOT_PRICE_BOOK_SILVER=PRICE_BOOK_ID
HUBSPOT_PRICE_BOOK_REGISTERED=PRICE_BOOK_ID
```

### 8. Create your Test partner and user account

#### Create a Contact

1. Contacts → Create contact
2. First name: "Alice"
3. Last name: "Smith"
4. Email: `alice@acme.example.com`
5. Scroll to custom properties:
   - `is_partner_portal_user` = **Yes**
   - `partner_user_role` = **admin** (or sales, etc.)
6. Save

#### Create a Company

1. Companies → Create company
2. Name: "Acme Corp"
3. Domain: `acme.example.com`
4. Scroll to custom properties:
   - `partner_tier` = **gold** (or platinum, silver, registered)
   - `partner_status` = **active**
   - `mdf_balance_available` = **50000**
5. Save

#### Associate Contact → Company

1. Open the Contact (Alice Smith)
2. Click **Add association** → Companies
3. Select "Acme Corp"
5. Save


## HubSpot App Setup


### 2. Authenticate with HubSpot

```bash
cd hubspot-project
hs account auth
```

This opens a browser for you to authorize access. Keep all permissions checked and click the Generate and send to CLI button.

Choose a unique name to reference this account, like PRM-dev-test and set it to your default account for now.

### 3. Deploy the HubSpot project

```bash
hs project upload
```

You'll be told the project does not exist in your account yet and asked if you would like to create it. Choose yes.

Verify with `hs project list-builds` — your build should appear in the list.

If the Build ID is not deployed, 

```bash
hs project deploy [Build ID]
```

### 4. Install the app on your portal

```bash
hs project open
```

In the browser:
- Click on the Project Name (Partner PRM) in the Project Components section.
- Go to **Distribution** tab
- In the Account section. click **Install now**
- Authorize scopes and connect the app.

```bash
hs project open
```

In the browser again, click on the Project Name (Partner PRM) in the Project Components section.

## NextJS Setup

### 1. Start the portal

```zsh
cd ..
cd partner-portal
npm install
npm run dev
```

Opens at `http://localhost:3000`. Sign in with any partner email from your HubSpot database + the `DEMO_PASSWORD`.

## Development

### Local HubSpot card development

```bash
cd hubspot-project
hs project dev
```

Watches for changes and syncs to HubSpot in real-time. Cards show a "Developing locally" tag while the dev server runs.

### Bypass authentication locally

Add to `.env.local` to skip login entirely (development only):

```bash
DEV_BYPASS_AUTH=true
DEV_COMPANY_ID=<your-test-company-id>
```

Get the company ID from any partner company record URL: `/crm/contacts/companies/<ID>`


## Project Structure

```
hubspot-prm-starter/
├── partner-portal/               # Next.js web app for partners
│   ├── src/
│   │   ├── app/                  # Pages (login, dashboard, etc.)
│   │   ├── lib/auth.ts           # NextAuth + HubSpot lookup
│   │   ├── lib/hubspot.ts        # CRM API layer
│   │   └── types/                # TypeScript types
│   ├── .env.local.example        # Environment template
│   └── package.json
├── hubspot-project/              # HubSpot app (UI extensions)
│   ├── src/app/
│   │   ├── cards/                # CRM tab extensions
│   │   ├── functions/            # Webhook handlers
│   │   └── app-hsmeta.json       # App configuration
│   ├── hsproject.json            # Project metadata
│   └── package.json
├── schema/                       # Custom object schemas (JSON)
├── properties/                   # CRM property definitions (JSONL)
└── README.md
```

## Key Concepts

### Deal Registrations

Partners submit opportunities for approval; channel managers track status and assign discounts. Includes conflict detection when multiple partners register the same customer.

### MDF (Marketing Development Funds)

Partners request and track marketing campaign funding, with tiered approval workflows by partner tier (Platinum, Gold, Silver, Registered).

### Partner Tiers

Four-tier hierarchy with sliding discounts, MDF budgets, and co-sell eligibility:

- **Platinum** — 15–25% discount, $100K MDF budget
- **Gold** — 10–20% discount, $50K MDF budget
- **Silver** — 5–15% discount, $20K MDF budget
- **Registered** — 0–10% discount, $5K MDF budget

### Co-Sell

Identifies deals eligible for joint selling; integrates with external partner networks (e.g., Microsoft).

## Auth Architecture

**Demo mode** (credentials provider): Partners enter email + shared password → app looks up contact in HubSpot → retrieves associated company + tier/budget/discounts → stores in session.

**Production**: Replace the `CredentialsProvider` in `src/lib/auth.ts` with Entra ID, Okta, Auth0, or your enterprise SSO.

## Common Tasks


**"DEV_BYPASS_AUTH not working"**

→ Set `HUBSPOT_ACCESS_TOKEN` and object type IDs first. Dev bypass still needs API access to fetch partner data.

---

**Questions?** Open an issue on GitHub or check the [HubSpot developer docs](https://developers.hubspot.com/).
