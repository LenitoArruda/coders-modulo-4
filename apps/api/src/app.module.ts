import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AuthModule } from "./modules/auth/auth.module";
import { CitationsModule } from "./modules/citations/citations.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { ExpertsModule } from "./modules/experts/experts.module";
import { HelloModule } from "./modules/hello/hello.module";
import { SourcesModule } from "./modules/sources/sources.module";
import { DatabaseModule } from "./modules/shared/database/database.module";
import { ErrorContractFilter } from "./modules/shared/interface/error-contract.filter";

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HelloModule,
    ExpertsModule,
    CitationsModule,
    ConversationsModule,
    SourcesModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ErrorContractFilter }],
})
export class AppModule {}
