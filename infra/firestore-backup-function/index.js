import functions from '@google-cloud/functions-framework';
import firestore from '@google-cloud/firestore';

const client = new firestore.v1.FirestoreAdminClient();

const PROJECT_ID = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
const BACKUP_BUCKET = process.env.BACKUP_BUCKET;

functions.http('scheduledFirestoreBackup', async (req, res) => {
  if (!PROJECT_ID) {
    console.error('Missing PROJECT_ID environment variable');
    res.status(500).send('Missing PROJECT_ID');
    return;
  }

  if (!BACKUP_BUCKET) {
    console.error('Missing BACKUP_BUCKET environment variable');
    res.status(500).send('Missing BACKUP_BUCKET');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputUriPrefix = `gs://${BACKUP_BUCKET}/${timestamp}`;
  const databaseName = client.databasePath(PROJECT_ID, '(default)');

  try {
    console.log(`Starting Firestore export to ${outputUriPrefix}`);

    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix,
      collectionIds: [],
    });

    console.log(`Export operation started: ${operation.name}`);
    res.status(200).send(`Export started: ${operation.name}`);
  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).send(`Export failed: ${error.message}`);
  }
});
