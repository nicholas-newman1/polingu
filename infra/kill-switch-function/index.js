import { cloudEvent } from '@google-cloud/functions-framework';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const KILL_SWITCH_DOC = db.collection('config').doc('killSwitch');

// Flip features when spend crosses this fraction of the monthly budget.
const DISABLE_THRESHOLD = 0.9;

cloudEvent('handleBudgetAlert', async (event) => {
  const message = event.data?.message;
  if (!message?.data) {
    console.warn('Budget alert received with no message data; ignoring.');
    return;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(message.data, 'base64').toString('utf8'));
  } catch (error) {
    console.error('Failed to parse budget alert payload:', error);
    return;
  }

  const {
    budgetDisplayName,
    alertThresholdExceeded,
    costAmount,
    budgetAmount,
    currencyCode,
  } = payload;

  console.log(
    `Budget "${budgetDisplayName}": cost=${costAmount} ${currencyCode}, budget=${budgetAmount} ${currencyCode}, thresholdExceeded=${alertThresholdExceeded ?? 'none'}`
  );

  if (typeof alertThresholdExceeded !== 'number') {
    return;
  }

  if (alertThresholdExceeded < DISABLE_THRESHOLD) {
    console.log(
      `Threshold ${alertThresholdExceeded} below disable cutoff ${DISABLE_THRESHOLD}; leaving kill switch alone.`
    );
    return;
  }

  const reason =
    `Auto-disabled: budget "${budgetDisplayName}" crossed ${(alertThresholdExceeded * 100).toFixed(0)}% ` +
    `(spent ${costAmount} / ${budgetAmount} ${currencyCode}).`;

  await KILL_SWITCH_DOC.set(
    {
      translateDisabled: true,
      audioDisabled: true,
      booksDisabled: true,
      reason,
      updatedAt: FieldValue.serverTimestamp(),
      lastThresholdExceeded: alertThresholdExceeded,
      lastCostAmount: costAmount,
      lastBudgetAmount: budgetAmount,
      lastCurrencyCode: currencyCode ?? 'USD',
    },
    { merge: true }
  );

  console.warn(`Kill switch engaged. ${reason}`);
});
