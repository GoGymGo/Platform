# Internal legal drafts

The connected preview uses visibly marked internal drafts for the legal-document
and receipt workflow. They are test fixtures for a non-production database, not
legal advice and not approval to open a public contest.

The canonical draft payload is
`config/legal/internal-testing-ca-bc-en.json`. It contains:

- a Terms of Service draft requiring affirmative acceptance; and
- a Privacy Policy draft requiring acknowledgment.

Both documents are published at `GLOBAL/en`, allowing pre-region account pages
and the verified `CA-BC/en` onboarding bundle to resolve the same current
versions. The app still records the requested `CA-BC` jurisdiction in the
receipt bundle.

## Research basis

The drafts are issue-spotting text based on these authoritative sources:

- [BC Personal Information Protection Act](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_03063_01)
- [Office of the Privacy Commissioner of Canada: meaningful consent](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)
- [Office of the Privacy Commissioner of Canada: mobile privacy notices](https://www.priv.gc.ca/en/privacy-topics/technology/mobile-and-digital-devices/mobile-apps/02_05_d_61_tips/)
- [Competition Bureau: promotional contests](https://competition-bureau.canada.ca/en/deceptive-marketing-practices/types-deceptive-marketing-practices/promotional-contests)
- [Competition Bureau promotional-contest enforcement guidelines](https://competition-bureau.canada.ca/en/promotional-contests-enforcement-guidelines)
- [Criminal Code, section 206](https://laws-lois.justice.gc.ca/eng/acts/C-46/section-206.html)
- [CRTC CASL guidance](https://crtc.gc.ca/eng/com500/guide.htm)
- [BC Age of Majority Act](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/96007_01)

The text deliberately leaves bracketed fields for the legal entity, address,
privacy officer, support channels, subprocessors, processing locations,
retention periods, liability language, and dispute terms. The contest rules
also remain an internal draft until real sponsor and prize details exist.

## Configure a non-production preview

From `backend`, validate without writing:

```powershell
npm.cmd run configure:internal-legal-drafts
```

Publish through the backend's audited, append-only operator service:

```powershell
$env:APPLY_INTERNAL_LEGAL_DRAFTS = 'yes'
npm.cmd run configure:internal-legal-drafts
```

The script:

- refuses to run when `NODE_ENV=production`;
- requires exactly one active, verified administrator unless
  `LEGAL_DRAFT_ADMIN_FIREBASE_UID` selects one;
- verifies the two required document keys and visible draft markers;
- rejects version reuse with different immutable content;
- is idempotent for an already-published matching version; and
- proves the resulting `CA-BC/en` bundle is configured.

## Before any public launch

Qualified Canadian counsel and the accountable business owner must replace all
bracketed fields, verify the actual data map and vendors, approve retention and
incident procedures, supply final official contest rules and prize disclosures,
and publish new immutable versions. The internal draft versions must not be
promoted into a production database.
