import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesServiceController } from './workspaces-service.controller';
import { WorkspacesServiceService } from './workspaces-service.service';

describe('WorkspacesServiceController', () => {
  let workspacesServiceController: WorkspacesServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesServiceController],
      providers: [WorkspacesServiceService],
    }).compile();

    workspacesServiceController = app.get<WorkspacesServiceController>(WorkspacesServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workspacesServiceController.getHello()).toBe('Hello World!');
    });
  });
});
