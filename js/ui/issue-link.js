// "Report an issue": opens the project's GitHub issues page in a new tab.
import { h } from '../util.js';
import { icon } from '../icons.js';

export const ISSUES_URL = 'https://github.com/fredy-mederos/guess_my_mess/issues';

export function issueLink(label = 'Report an issue') {
  return h('a.btn.small.ghost.issue-link', {
    href: ISSUES_URL,
    target: '_blank',
    rel: 'noopener',
    title: 'Found a bug or have an idea? Opens GitHub issues',
  }, icon('github'), label);
}
