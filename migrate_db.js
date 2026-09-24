const mongoose = require('mongoose');

// Connection URIs from your .env
const SOURCE_URI = 'mongodb+srv://pankajexpdeveloper:9wmjWhNerxBtCF3h@cluster0.fkqpdum.mongodb.net/PipeWyze?retryWrites=true&w=majority&appName=Cluster0';
const TARGET_URI = 'mongodb+srv://pipewyze_db_user:ct0P2vLAbrU3VyBz@cluster0.aojjhj0.mongodb.net/PipeWyze?retryWrites=true&w=majority&appName=Cluster0';

async function migrateData() {
  console.log('🚀 Starting Database Migration Script...');
  
  // Create connections
  const sourceConn = await mongoose.createConnection(SOURCE_URI).asPromise();
  console.log('✅ Connected to Source Database (pankajexpdeveloper)');
  
  const targetConn = await mongoose.createConnection(TARGET_URI).asPromise();
  console.log('✅ Connected to Target Database (live cluster0)');

  // List all collections from source
  const collections = await sourceConn.db.listCollections().toArray();
  console.log(`\n📋 Found ${collections.length} collection(s) to migrate:`);
  collections.forEach((col) => console.log(`   - ${col.name}`));

  console.log('\n----------------------------------------');

  for (const col of collections) {
    const colName = col.name;
    console.log(`⏳ Migrating collection: "${colName}"...`);

    const sourceCol = sourceConn.db.collection(colName);
    const targetCol = targetConn.db.collection(colName);

    // Fetch documents from source
    const docs = await sourceCol.find({}).toArray();

    if (docs.length === 0) {
      console.log(`ℹ️  Collection "${colName}" is empty. Skipping.`);
      continue;
    }

    // Insert documents into target using bulkWrite (ordered: false to skip duplicates safely)
    const operations = docs.map((doc) => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true,
      },
    }));

    const result = await targetCol.bulkWrite(operations, { ordered: false });
    console.log(`✅ Collection "${colName}": ${docs.length} documents processed (Upserted/Updated: ${result.upsertedCount + result.modifiedCount || docs.length}).`);
  }

  console.log('\n🎉 Migration completed successfully!');

  await sourceConn.close();
  await targetConn.close();
  process.exit(0);
}

migrateData().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
