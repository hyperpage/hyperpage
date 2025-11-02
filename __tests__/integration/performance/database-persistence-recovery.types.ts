// TypeScript interfaces for database-persistence-recovery.test.ts
// These interfaces replace the extensive 'any' type usage in the test file

export interface TestUser {
  // Base properties that may exist on test users
  sessionId?: string;
  userId?: string;
  lastAccessed?: string;
  [key: string]: unknown;
}

export interface SessionData {
  concurrentUpdate?: number;
  timestamp?: number;
  operationId?: string;
  [key: string]: unknown;
}

export interface TransactionTest {
  writeOperation: number;
  timestamp: number;
  sessionId: string;
  [key: string]: unknown;
}

export interface RecoveryTestData {
  recoveryTest: boolean;
  initialState: string;
  operationCount: number;
  timestamp: number;
  recoveryAttempt?: boolean;
  recoveredTimestamp?: number;
  [key: string]: unknown;
}

export interface PersistentData {
  persistentId: string;
  createdAt: number;
  modificationHistory: Array<{
    operation: string;
    timestamp: number;
  }>;
  [key: string]: unknown;
}

export interface BatchOperation {
  operationId: number;
  batchId: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface SessionActivity {
  [operationKey: string]: {
    timestamp: number;
    sessionIndex: number;
    operationIndex: number;
  };
}

export interface TimePersistenceTest {
  startTime: number;
  checkpoints: Array<{
    timeElapsed: number;
    checkpoint: number;
  }>;
  duration: number;
  [key: string]: unknown;
}

export interface LifecyclePhase {
  lifecyclePhase: 'active' | 'invalidated';
  lifecycleIndex: number;
  invalidationTime?: number;
  [key: string]: unknown;
}

export interface PeakLoadTest {
  accessIndex: number;
  accessTime: number;
  peakLoadPhase: string;
  updatedTime?: number;
  [key: string]: unknown;
}

export interface RelationshipReference {
  id: string;
  type: string;
  referencesPrimary: boolean;
  referenceId: string;
}

export interface CrossReference {
  id: string;
  bidirectional: boolean;
  linkedTo: string[];
}

export interface RelationshipData {
  primary: {
    id: string;
    type: string;
    timestamp: number;
  };
  references: RelationshipReference[];
  crossReferences: CrossReference[];
}

export interface ReferentialIntegrityData {
  references?: RelationshipReference[];
  primary?: {
    id: string;
  };
  crossReferences?: CrossReference[];
}

export interface LegacyData {
  oldField1: string;
  oldField2: string;
  oldTimestamp: number;
}

export interface NewData {
  migratedField1: string;
  migratedField2: string;
  migrationTimestamp: number;
}

export interface MigrationSource {
  migrationId: string;
  version: number;
  legacyData?: LegacyData;
  newData?: NewData;
  [key: string]: unknown;
}

export interface ConcurrentWriteResult {
  sessionId: string;
  userId: string;
  operationId: number;
  dataUpdated: boolean;
  timestamp: number;
}

export interface UserData {
  sessionId: string;
  lastAccessed: string;
  hasData: boolean;
}

export interface ConcurrentReadResult {
  readId: number;
  sessionId: string;
  userId: string;
  data: UserData | null;
  readTimestamp: number;
}

export interface TransactionOperationResult {
  operationId: number;
  type: 'read' | 'write';
  sessionId: string;
  success: boolean;
  dataConsistent?: boolean;
  timestamp: number;
}

export interface RecoveryResult {
  operationId: number;
  success: boolean;
  error?: string;
  sessionId: string;
  timestamp: number;
}

export interface SessionOperationResult {
  sessionIndex: number;
  operationIndex: number;
  sessionId: string;
  activityRecorded: boolean;
}

export interface SessionLoadResult {
  sessionId: string;
  operations: SessionOperationResult[];
  allOperationsSuccessful: boolean;
}

export interface LifecycleResult {
  originalSessionId: string;
  newSessionId: string;
  originalPhase: string;
  recreatedPhase: string;
  recreationSuccessful: boolean;
}

export interface PeakAccessResult {
  accessIndex: number;
  sessionId: string;
  read1: boolean;
  write: boolean;
  read2: boolean;
  update: boolean;
  finalData: PeakLoadTest | null;
}

export interface RelationshipResult {
  relationshipId: number;
  sessionId: string;
  primaryCreated: boolean;
  referencesCreated: boolean;
  crossReferencesCreated: boolean;
  referentialIntegrity: boolean;
}

export interface MigrationResult {
  migrationId: number;
  sessionId: string;
  readAccess: TestUser | null;
  postMigrationAccess: TestUser | null;
  migrationSuccessful: boolean;
}
