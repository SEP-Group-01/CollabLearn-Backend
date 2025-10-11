const { createClient } = require('@supabase/supabase-js');
const Y = require('yjs');

// Load environment variables if using dotenv
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixCorruptedYjsStates() {
  try {
    console.log('🔍 Checking for documents with corrupted Y.js states...');

    // Get all documents
    const { data: documents, error } = await supabase
      .from('documents')
      .select('id, title, content, yjs_state')
      .eq('is_deleted', false);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    console.log(`📄 Found ${documents.length} documents to check`);

    let fixedCount = 0;

    for (const doc of documents) {
      try {
        // Try to parse the Y.js state
        if (!doc.yjs_state || doc.yjs_state.length === 0) {
          console.log(`⚠️  Document ${doc.id} has empty Y.js state`);
          await regenerateYjsState(doc);
          fixedCount++;
          continue;
        }

        // Convert to Buffer if needed
        let stateBuffer;
        if (Buffer.isBuffer(doc.yjs_state)) {
          stateBuffer = doc.yjs_state;
        } else if (typeof doc.yjs_state === 'string') {
          stateBuffer = Buffer.from(doc.yjs_state, 'base64');
        } else {
          stateBuffer = Buffer.from(doc.yjs_state);
        }

        // Try to create Y.js document and apply state
        const ydoc = new Y.Doc();
        try {
          Y.applyUpdate(ydoc, stateBuffer);
          const ytext = ydoc.getText('content');
          console.log(`✅ Document ${doc.id} Y.js state is valid (content length: ${ytext.length})`);
        } catch (parseError) {
          console.log(`❌ Document ${doc.id} has corrupted Y.js state: ${parseError.message}`);
          await regenerateYjsState(doc);
          fixedCount++;
        }
      } catch (checkError) {
        console.error(`Error checking document ${doc.id}:`, checkError.message);
        await regenerateYjsState(doc);
        fixedCount++;
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} documents with corrupted Y.js states`);
  } catch (error) {
    console.error('❌ Error fixing Y.js states:', error);
    process.exit(1);
  }
}

async function regenerateYjsState(doc) {
  try {
    console.log(`🔧 Regenerating Y.js state for document ${doc.id}...`);

    // Create new Y.js document
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('content');

    // Insert the content from the database
    if (doc.content && doc.content.length > 0) {
      ytext.insert(0, doc.content);
    } else {
      // Insert empty string to ensure valid state
      ytext.insert(0, '');
    }

    // Generate new Y.js state
    const newYjsState = Y.encodeStateAsUpdate(ydoc);

    // Update database
    const { error } = await supabase
      .from('documents')
      .update({
        yjs_state: Buffer.from(newYjsState),
        updated_at: new Date().toISOString(),
      })
      .eq('id', doc.id);

    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }

    console.log(`✅ Regenerated Y.js state for document ${doc.id} (${newYjsState.length} bytes)`);
  } catch (error) {
    console.error(`❌ Failed to regenerate Y.js state for document ${doc.id}:`, error.message);
  }
}

// Run the script
fixCorruptedYjsStates().then(() => {
  console.log('\n🎉 Y.js state fixing completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});