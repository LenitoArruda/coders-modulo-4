import { Controller, Get, Inject } from "@nestjs/common";

import {
  GetHelloUseCase,
  type HelloResponse,
} from "../application/get-hello.use-case";

@Controller()
export class HelloController {
  constructor(
    @Inject(GetHelloUseCase)
    private readonly getHello: GetHelloUseCase,
  ) {}

  @Get()
  getHelloMessage(): HelloResponse {
    return this.getHello.execute();
  }
}
