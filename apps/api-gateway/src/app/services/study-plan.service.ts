import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StudyPlanService {
  private readonly studyPlanServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.studyPlanServiceUrl =
      this.configService.get('STUDY_PLAN_SERVICE_URL') ||
      'http://localhost:8002';
  }

  private async makeHttpRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
  ) {
    const url = `${this.studyPlanServiceUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error making request to ${url}:`, error);
      throw new HttpException(
        error?.message || 'Study plan service error',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async getHealth() {
    return await this.makeHttpRequest('/health');
  }

  async getUserTimeSlots(userId: string) {
    return await this.makeHttpRequest(`/api/users/${userId}/time-slots`);
  }

  async getWorkspaceResources(userId: string, workspaceId: string) {
    return await this.makeHttpRequest(
      `/api/users/${userId}/workspaces/${workspaceId}/resources`,
    );
  }

  async getWorkspaceThreads(userId: string, workspaceId: string) {
    return await this.makeHttpRequest(
      `/api/users/${userId}/workspaces/${workspaceId}/threads`,
    );
  }

  async getUserStudyPlans(userId: string) {
    return await this.makeHttpRequest(`/api/users/${userId}/study-plans`);
  }

  async updateProgress(userId: string, progressUpdate: any) {
    return await this.makeHttpRequest(
      `/api/users/${userId}/progress`,
      'POST',
      progressUpdate,
    );
  }

  async analyzeFeasibility(request: any) {
    return await this.makeHttpRequest(
      '/api/analytics/feasibility',
      'POST',
      request,
    );
  }

  async getDbTest(userId: string) {
    return await this.makeHttpRequest(`/db-test/${userId}`);
  }

  async getEnvCheck() {
    return await this.makeHttpRequest('/env-check');
  }
}
