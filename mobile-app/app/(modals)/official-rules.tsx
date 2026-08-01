import { LegalDocumentScreen } from '@/components/legal';
import { officialContestRules, type LegalDocument } from '@/constants/legal';
import { useAppTour } from '@/state/appTour';

const browserPreviewRules: LegalDocument = {
  effectiveDate: 'BROWSER PREVIEW',
  intro:
    'No live prize competition is open in this preview. This screen lets testers review the contest-rules experience with sample information.',
  sections: [
    {
      body: 'Weekly Goals, entries, rankings and rewards shown in the browser preview are sample data and do not create eligibility or a real-world prize claim.',
      heading: 'PREVIEW ACTIVITY'
    },
    {
      body: 'Official rules will identify the operator, eligible regions, dates, prizes, odds, entry method and winner process before any live competition opens.',
      heading: 'BEFORE A LIVE COMPETITION'
    }
  ],
  title: 'CONTEST RULES PREVIEW'
};

export default function OfficialContestRulesModal() {
  const { active: appTourActive } = useAppTour();

  return (
    <LegalDocumentScreen
      document={appTourActive ? browserPreviewRules : officialContestRules}
    />
  );
}
