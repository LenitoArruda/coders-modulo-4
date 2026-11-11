import { Module } from "@nestjs/common";

import { GetHelloUseCase } from "./application/get-hello.use-case";
import { GetHelloRequestHandler } from "./interface/request-handlers/get-hello.request-handler";

@Module({
  controllers: [GetHelloRequestHandler],
  providers: [GetHelloUseCase],
})
export class HelloModule {}
