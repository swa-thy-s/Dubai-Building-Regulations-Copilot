# LEGAL.md: Website legal content for the Dubai Regulations Copilot

**For Claude Code:** this file is the source text for the site's legal pages and notices. Build the pages and components listed in section 0 from it. Do not rewrite, shorten or soften the wording. Replace the placeholders in `[SQUARE BRACKETS]` with real values (ask the owner if any are missing). Never ship a page that still contains a placeholder.

**For the owner:** this is a draft, not legal advice. Have a lawyer review it before a public launch. The two parts that matter most are the "Reference tool only" notices (sections 1 and 2) and the copyright and sources notice (section 5).

Placeholders to fill in: `[APP NAME]`, `[OWNER FULL NAME]`, `[CONTACT EMAIL]`, `[COUNTRY OF OWNER]`, `[GOVERNING LAW AND COURTS]`, `[LAST UPDATED DATE]`, `[RETENTION DAYS]` (default 90).

---

## 0. Where each piece goes

| Piece | Where it appears | Source section |
| --- | --- | --- |
| Top banner (one line) | Every page, always visible, not dismissible | 1.1 |
| First-use acknowledgement | Modal on the first visit to the tool page (`/ask`; the landing page `/` shows only the banner). The question box stays disabled until the user ticks the box and continues. Remember the choice in `localStorage` (wrapped in try/catch) and ask again if the text version changes | 1.2 |
| Answer footer | Under every answer, every abstain message and every nearest-clause list. Not collapsible | 1.3 |
| Input hint | Under the question box | 1.4 |
| `/disclaimer` page | Linked from the banner and the footer | 2 |
| `/terms` page | Footer link | 3 |
| `/privacy` page | Footer link and linked from the acknowledgement modal | 4 |
| `/sources` page | Footer link, corpus panel, and "Source" link on every clause card | 5 |
| Footer | Every page: Disclaimer, Terms, Privacy, Sources, Contact | , |

Version every legal text with the `[LAST UPDATED DATE]` shown at the top of its page. Bump a `LEGAL_VERSION` constant when wording changes so the modal reappears.

---

## 1. Short notices (exact text)

### 1.1 Top banner

> **Reference tool only. Not official, not legal or professional advice. Always confirm with the relevant authority.**

### 1.2 First-use acknowledgement (modal)

Title: **Before you use [APP NAME]**

> [APP NAME] is a **reference tool only**. It helps you find and read clauses from published Dubai building regulations. It is **not** an official source, it is **not** affiliated with or endorsed by Dubai Municipality, Trakhees, RERA, the Dubai Land Department or any other government body, and it does **not** give legal, engineering, architectural or compliance advice.
>
> Answers may be incomplete, out of date or wrong. **Do not rely on it for design, permit, construction or legal decisions.** Always check the original document and confirm requirements with the relevant authority or a qualified professional.
>
> Do not enter confidential or personal information. Questions are processed by third-party AI services.

Checkbox label (required to continue): **I understand this is a reference tool only and I will verify anything important with the relevant authority.**

Buttons: **Continue**. Links: Disclaimer, Terms, Privacy.

### 1.3 Answer footer

> **Reference tool only. Not an official ruling and not advice.** Check the cited clause in the official document and confirm with the relevant authority before relying on this. English text is a translation; the Arabic version prevails legally. Documents shown were last verified on [LAST VERIFIED DATE FROM DATABASE].

### 1.4 Input hint

> Reference tool only. Don't enter confidential or personal details.

### 1.5 Copy rules for the whole app

- Never write that a design, drawing or product "complies", "is compliant", "is approved", "is permitted" or "is safe". Write what the clause says instead, for example "Clause 3.2.1 sets a minimum of …".
- Never use government logos, crests or colours that imitate an authority's identity.
- Never name the app or describe it as official, certified or approved.

---

## 2. Disclaimer page (`/disclaimer`)

**Last updated: [LAST UPDATED DATE]**

### Reference tool only

**[APP NAME] is a reference tool only.** It is a personal, independent project that uses software to search published regulatory documents and summarise what they say, with links to the clauses it used. It is provided free of charge and in beta.

### What it is not

- **It is not an official source.** It is not operated, endorsed, approved or sponsored by Dubai Municipality, Trakhees, the Real Estate Regulatory Agency (RERA), the Dubai Land Department, the Government of Dubai or any other authority.
- **It is not legal, engineering, architectural, safety or compliance advice.** Nothing it produces is a ruling, an approval, a permit, a certification or a statement that any design or building complies with any requirement.
- **It is not a substitute for the original documents or for a qualified professional.**

### Accuracy and currency

- Answers are produced with the help of artificial intelligence. **They can be wrong, incomplete or misleading**, even when they cite a clause.
- Documents may be amended, superseded or supplemented by circulars and other instruments that this tool does not contain. Documents are checked periodically, but **we do not guarantee that any document is the latest version.** The edition and "last verified" date shown are the only statement of what was checked and when.
- Tables, figures, drawings and footnotes can be lost or misread during processing. Always read the original page.
- The English text of regulations is a translation. **The Arabic version prevails** where the law says so.
- The tool covers only the documents listed on the [Sources page](/sources). If a topic is not listed, the tool has no information on it.

### Your responsibility

By using [APP NAME] you accept that:

1. You must **verify every requirement in the official document** and **confirm it with the relevant authority** before relying on it.
2. You are solely responsible for any design, permit application, construction, purchase, investment or other decision you make.
3. You will not treat any output as advice, approval or proof of compliance, and you will not present it to a client, contractor or authority as such.

### Limitation

To the fullest extent permitted by law, the owner accepts no responsibility or liability for any loss, damage, delay, cost, rejection, penalty or claim arising from use of, or reliance on, [APP NAME] or its outputs. Nothing in this page excludes liability that cannot be excluded by law.

### Report a problem

If you find a wrong or outdated answer, use the "Report a wrong answer" button or write to [CONTACT EMAIL].

---

## 3. Terms of Use (`/terms`)

**Last updated: [LAST UPDATED DATE]**

These terms apply to your use of [APP NAME] (the "Service"), operated by [OWNER FULL NAME] ("the owner", "we"), based in [COUNTRY OF OWNER]. By using the Service you agree to them. If you do not agree, do not use it.

**1. Reference tool only.** The Service is a reference tool only, as set out in the [Disclaimer](/disclaimer), which forms part of these terms. It is not official and not advice.

**2. No professional relationship.** Using the Service does not create a lawyer–client, engineer–client, architect–client, consultant–client or any other professional relationship.

**3. Free beta service.** The Service is provided free of charge, as is and as available, as a beta. We may change, limit, suspend or stop it at any time, without notice.

**4. No warranties.** To the fullest extent permitted by law, we give no warranty of any kind, express or implied, including accuracy, completeness, currency, fitness for a particular purpose, availability or non-infringement.

**5. Limitation of liability.** To the fullest extent permitted by law, we are not liable for any direct, indirect, incidental, consequential or special loss or damage, including loss of profit, data, business, reputation, or costs of delay, rework, rejection or penalty, arising from your use of or reliance on the Service. If liability cannot be excluded, it is limited to the greatest extent permitted by law. Nothing here excludes liability for fraud, or any liability that cannot lawfully be excluded.

**6. Your responsibilities.** You will (a) verify everything in the official documents and with the relevant authority before relying on it; (b) not enter confidential, commercially sensitive or personal information (including client names, project addresses or drawings); (c) not use the Service for anything unlawful; (d) not scrape, overload, probe, reverse engineer or try to bypass its limits; (e) not use outputs as evidence of compliance in any submission or dispute without checking the original source.

**7. Indemnity.** You agree to indemnify us against claims arising from your misuse of the Service or your breach of these terms, to the extent permitted by law.

**8. Third-party content and ownership.** The regulations and other documents quoted in the Service belong to their respective publishers. We do not claim ownership of them. See the [Sources page](/sources). The Service's own software, design and original text are owned by the owner. You may link to the Service. You may not copy it at scale or present it as your own.

**9. Third-party services.** The Service relies on third-party providers (see the [Privacy Policy](/privacy)). We are not responsible for their availability or acts.

**10. Takedown and corrections.** If you are a rights holder or an authority and want content changed or removed, write to [CONTACT EMAIL]. We will act promptly.

**11. Changes.** We may update these terms. The date at the top shows the latest version. Continued use after a change means you accept it.

**12. Governing law.** These terms are governed by [GOVERNING LAW AND COURTS]. Mandatory consumer rights that cannot be waived in your country are not affected.

**13. Contact.** [CONTACT EMAIL]

---

## 4. Privacy Policy (`/privacy`)

**Last updated: [LAST UPDATED DATE]**

[OWNER FULL NAME] operates [APP NAME]. This policy explains what data the Service handles. We keep it to the minimum needed. There are no accounts, no advertising and no sale of data.

### 4.1 What we collect

| Data | Why | Kept for |
| --- | --- | --- |
| **Your questions** (the text you type) and the answers produced | To produce the answer, find errors, and improve accuracy | [RETENTION DAYS] days, then deleted automatically |
| **A hashed form of your IP address** (not the IP itself) | To limit abuse and enforce rate limits | [RETENTION DAYS] days |
| **Feedback** you submit (rating, comment, suggested clause) | To correct errors and improve the tool | [RETENTION DAYS] days unless needed to fix a reported error |
| **Technical logs** (time, errors, response time) | To keep the Service working and secure | Provider default, usually up to 30 days |
| **A setting saved in your browser** (that you accepted the notice) | So you are not asked every time | Until you clear browser storage |

We do **not** ask for your name or email, and we do not use advertising or tracking cookies. If you email us, we keep your message to reply to it.

**Please do not type personal, confidential or commercially sensitive information into the question box.** Anything you type may be stored and sent to the providers below.

### 4.2 Who processes your data

| Provider | Role |
| --- | --- |
| Google (Gemini API) | Receives your question and the matched clauses to generate the answer and to search. On the free service tier, Google may use submitted content to improve its products, which can involve human review. Do not submit anything you would not want Google to see. **[Remove this sentence only if the owner has moved to a paid tier that is excluded from training and confirmed it in writing.]** |
| Supabase | Database and file storage |
| Vercel | Website hosting and logs |
| GitHub | Hosts the code and runs scheduled checks (no user data) |

These providers may process data in countries other than yours. We do not sell your data and do not share it with anyone else, except where the law requires.

### 4.3 Legal bases and your rights

We process the data above to run and secure the Service and to improve its accuracy (our legitimate interest). Depending on where you live, including under the UAE Personal Data Protection Law and, where applicable, other data protection laws, you may have the right to ask for access to, correction of, or deletion of your data, and to object to processing. Because we do not know who you are, include the **exact text of your question and the approximate time** so we can find it. Write to [CONTACT EMAIL]. We will reply within a reasonable time and, where required, within the period the law sets.

### 4.4 Security

Data is stored with the providers above, access is limited to the owner, database access is restricted to the server, and keys are not exposed to browsers. No system is perfectly secure and we cannot guarantee absolute security.

### 4.5 Children

The Service is for professionals and is not directed at anyone under 18. Do not use it if you are under 18.

### 4.6 Changes and contact

We may update this policy. The date above shows the latest version. Questions: [CONTACT EMAIL].

---

## 5. Sources and copyright notice (`/sources`)

**Last updated: [LAST UPDATED DATE]**

### 5.1 Notice (exact text)

> **[APP NAME] is not affiliated with, endorsed by, or sponsored by Dubai Municipality, Trakhees, the Real Estate Regulatory Agency (RERA), the Dubai Land Department or any government body.** Regulations, codes and other documents quoted here belong to their respective publishers and are shown as short extracts, with attribution and a link to the official source, for reference and discussion only. Rights in those documents remain with their owners. If you are a rights holder and want an extract changed or removed, write to [CONTACT EMAIL] and we will act promptly. **Always read the official document and confirm with the relevant authority.**

### 5.2 Source table

Generate this table from the database (`documents` table) at build time or on request. It MUST show, for each document: title, publisher/authority, edition, status (current or superseded), official link, date ingested, and **date last verified**.

| Title | Publisher | Edition | Status | Official link | Last verified |
| --- | --- | --- | --- | --- | --- |
| *(from database)* | | | | | |

### 5.3 How we keep sources up to date

Official sources are checked automatically every two weeks and manually every quarter. A check can miss changes, and some sites cannot be checked automatically. The "last verified" date is the date of the last successful check. **It is not a guarantee that no newer version exists.**

---

## 6. Short UI strings (for components)

| Key | Text |
| --- | --- |
| `abstain.title` | Not found in the indexed documents. |
| `abstain.body` | This tool only covers the documents listed on the Sources page. Check the official document or ask the relevant authority. |
| `outofscope` | This tool covers Dubai building codes and approvals only. Reference tool only. |
| `stale.banner` | Some sources have not been verified recently. Check the official document before relying on any answer. |
| `clause.source` | Source: [document], [edition], clause [number], page [page]. Open official source |
| `feedback.prompt` | Wrong or out of date? Tell us. |
| `error.capacity` | The tool is at capacity. Try again later. This is a reference tool only; do not rely on it for time-critical decisions. |

---

## 7. Acceptance tests for Claude Code

1. The top banner text (1.1) is present on every route and cannot be dismissed.
2. On first visit the modal (1.2) appears, the question box is disabled until the checkbox is ticked, and after changing `LEGAL_VERSION` the modal appears again.
3. The footer text (1.3) appears under every answer, abstain, out-of-scope and error-with-clauses state. A snapshot test fails if it is missing.
4. `/disclaimer`, `/terms`, `/privacy`, `/sources` render from this file's text with no unreplaced `[PLACEHOLDER]` strings. A build-time check greps for `[` followed by an uppercase word and `]` and fails the build.
5. A search of the generated UI text and the model's system prompt output finds none of the banned words in 1.5 used as claims about a user's design.
6. The Sources page table matches the `documents` table, including last-verified dates.
7. A deletion job removes `query_logs` and `feedback` rows older than `RETENTION_DAYS`, and a test proves it.
