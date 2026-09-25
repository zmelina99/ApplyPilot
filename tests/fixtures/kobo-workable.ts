import { normalizeWorkableFields, type WorkableRawField } from '../../src/prep/workableInspector.js';
import type { NormalizedQuestion } from '../../src/prep/providers.js';

const KOBO_RAW: WorkableRawField[] = [
  { providerFieldId: 'firstname', label: 'First name', fieldType: 'text', required: true, placeholder: '', options: null },
  { providerFieldId: 'lastname', label: 'Last name', fieldType: 'text', required: true, placeholder: '', options: null },
  { providerFieldId: 'email', label: 'Email', fieldType: 'email', required: true, placeholder: '', options: null },
  { providerFieldId: 'resume', label: 'Resume', fieldType: 'file', required: true, placeholder: '', options: null },
  {
    providerFieldId: 'QA_12317170',
    label: 'Tell us with specific detail about work you have done that qualifies you to join KoboToolbox as a Senior Frontend Web Application Developer.',
    fieldType: 'textarea', required: true, placeholder: '', options: null,
  },
  { providerFieldId: 'QA_12317171', label: 'Why would you like to join the Kobo core technical team?', fieldType: 'textarea', required: true, placeholder: '', options: null },
  { providerFieldId: 'QA_12317172', label: 'When could you begin working with us?', fieldType: 'text', required: true, placeholder: 'MM/DD/YYYY', options: null },
  { providerFieldId: 'QA_12317173', label: 'On average, how many hours could you commit to Kobo per week?', fieldType: 'text', required: true, placeholder: '', options: null },
  {
    providerFieldId: 'QA_12317174',
    label: 'If desired, upload an archive of materials (e.g. screenshots) to complement your description above.',
    fieldType: 'file', required: true, placeholder: '', options: null,
  },
  { providerFieldId: 'QA_12317175', label: 'Country (or territory) of residence', fieldType: 'text', required: true, placeholder: '', options: null },
  { providerFieldId: 'QA_12317176', label: 'How much compensation (in USD) would you expect per hour of labor?', fieldType: 'text', required: true, placeholder: '', options: null },
];

export function koboQuestionsFixture(): NormalizedQuestion[] {
  return normalizeWorkableFields(KOBO_RAW);
}
