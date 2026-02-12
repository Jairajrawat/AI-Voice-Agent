import { PrismaService } from '../config/prisma.config';

/**
 * Data Cleanup Job
 * Automatically deletes expired caller data based on tenant retention policy
 * Runs daily via cron job or scheduler
 */
export class DataCleanupJob {
  private prisma = PrismaService.getInstance().client;

  /**
   * Run the cleanup job
   * Deletes callers where expiresAt < now AND isSaved = false
   */
  async run(): Promise<{
    success: boolean;
    deletedCallers: number;
    deletedCalls: number;
    deletedTranscripts: number;
    deletedExtractions: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedCallers = 0;
    let deletedCalls = 0;
    let deletedTranscripts = 0;
    let deletedExtractions = 0;

    try {
      console.log('🧹 Starting data cleanup job...');

      // Find all expired callers
      const expiredCallers = await this.prisma.caller.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
          isSaved: false,
        },
        include: {
          calls: {
            select: {
              id: true,
            },
          },
        },
      });

      console.log(`📊 Found ${expiredCallers.length} expired callers to delete`);

      for (const caller of expiredCallers) {
        try {
          // Delete transcripts and extractions for each call
          for (const call of caller.calls) {
            const transcriptsResult = await this.prisma.transcript.deleteMany({
              where: { callId: call.id },
            });
            deletedTranscripts += transcriptsResult.count;

            const extractionsResult = await this.prisma.extraction.deleteMany({
              where: { callId: call.id },
            });
            deletedExtractions += extractionsResult.count;

            // Delete recordings
            await this.prisma.recording.deleteMany({
              where: { callId: call.id },
            });
          }

          // Delete calls
          const callsResult = await this.prisma.call.deleteMany({
            where: { callerId: caller.id },
          });
          deletedCalls += callsResult.count;

          // Delete caller
          await this.prisma.caller.delete({
            where: { id: caller.id },
          });
          deletedCallers++;

          console.log(`✅ Deleted caller ${caller.id} (${caller.phoneNumber})`);
        } catch (error) {
          const errorMsg = `Error deleting caller ${caller.id}: ${(error as Error).message}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      console.log('✅ Data cleanup job completed');
      console.log(`📊 Summary:`);
      console.log(`   - Deleted callers: ${deletedCallers}`);
      console.log(`   - Deleted calls: ${deletedCalls}`);
      console.log(`   - Deleted transcripts: ${deletedTranscripts}`);
      console.log(`   - Deleted extractions: ${deletedExtractions}`);
      console.log(`   - Errors: ${errors.length}`);

      return {
        success: true,
        deletedCallers,
        deletedCalls,
        deletedTranscripts,
        deletedExtractions,
        errors,
      };
    } catch (error) {
      const errorMsg = `Fatal error in cleanup job: ${(error as Error).message}`;
      console.error(`❌ ${errorMsg}`);
      errors.push(errorMsg);

      return {
        success: false,
        deletedCallers,
        deletedCalls,
        deletedTranscripts,
        deletedExtractions,
        errors,
      };
    }
  }

  /**
   * Preview what would be deleted without actually deleting
   */
  async preview(): Promise<{
    wouldDelete: number;
    callers: Array<{
      id: string;
      phoneNumber: string;
      tenantId: string;
      expiresAt: Date;
      totalCalls: number;
    }>;
  }> {
    const callers = await this.prisma.caller.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        isSaved: false,
      },
      include: {
        _count: {
          select: { calls: true },
        },
      },
      take: 100, // Limit preview to 100
    });

    return {
      wouldDelete: callers.length,
      callers: callers.map((c: any) => ({
        id: c.id,
        phoneNumber: c.phoneNumber,
        tenantId: c.tenantId,
        expiresAt: c.expiresAt!,
        totalCalls: c._count.calls,
      })),
    };
  }
}

// Export singleton
export const dataCleanupJob = new DataCleanupJob();
