import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces-service.controller';
import { WorkspacesService } from './workspaces.service';

describe('WorkspacesController', () => {
  let workspacesController: WorkspacesController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [WorkspacesService],
    }).compile();

    workspacesController = app.get<WorkspacesController>(WorkspacesController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(workspacesController.getHello()).toBe('Hello World! from Workspaces Service');
    });
  });
});
