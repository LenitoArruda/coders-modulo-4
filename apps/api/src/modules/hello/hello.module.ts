import { Module } from "@nestjs/common";

import { GetHelloUseCase } from "./application/get-hello.use-case";
import { HelloController } from "./interface/hello.controller";

@Module({
  controllers: [HelloController],
  providers: [GetHelloUseCase],
})
export class HelloModule {}
