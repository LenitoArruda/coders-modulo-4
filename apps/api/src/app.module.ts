import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { AuthModule } from "./modules/auth/auth.module";
import { HelloModule } from "./modules/hello/hello.module";
import { ErrorContractFilter } from "./modules/shared/interface/error-contract.filter";

@Module({
  imports: [AuthModule, HelloModule],
  providers: [{ provide: APP_FILTER, useClass: ErrorContractFilter }],
})
export class AppModule {}
