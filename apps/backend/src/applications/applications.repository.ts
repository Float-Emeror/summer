import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationStatus } from '@prisma/client';

@Injectable()
export class ApplicationsRepository {
  constructor(private prisma: PrismaService) {}

  async getTeamBasicInfo(teamId: string) {
    return this.prisma.team.findUnique({
      where: { id: teamId },
      include: { members: true }
    });
  }

  async checkExistingApplication(teamId: string, applicantId: string) {
    return this.prisma.application.findUnique({
      where: { teamId_applicantId: { teamId, applicantId } }
    });
  }

  async createApplication(teamId: string, applicantId: string, reason: string) {
    return this.prisma.application.create({
      data: { teamId, applicantId, reason, status: 'PENDING' }
    });
  }

  async findApplicationsByTeam(teamId: string) {
    return this.prisma.application.findMany({
      where: { teamId },
      include: {
        applicant: {
          select: {
            profile: true,
            email: true,
            creditSnapshots: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findApplicationById(applicationId: string) {
    return this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { team: true }
    });
  }

  async reviewApplication(applicationId: string, status: ApplicationStatus) {
    return this.prisma.$transaction(async (prisma) => {
      const application = await prisma.application.update({
        where: { id: applicationId },
        data: { status, reviewedAt: new Date() }
      });

      if (status === 'APPROVED') {
        await prisma.teamMember.create({
          data: {
            teamId: application.teamId,
            userId: application.applicantId,
            role: 'MEMBER'
          }
        });
      }
      return application;
    });
  }
}
