import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { ListExpertsUseCase } from "./application/list-experts.use-case";
import { ListExpertsRequestHandler } from "./interface/request-handlers/list-experts.request-handler";

@Module({
  imports: [AuthModule],
  controllers: [ListExpertsRequestHandler],
  providers: [ListExpertsUseCase],
})
export class ExpertsModule {}
