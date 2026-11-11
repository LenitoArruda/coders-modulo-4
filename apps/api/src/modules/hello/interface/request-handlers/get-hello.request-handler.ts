import { Controller, Get, Inject } from "@nestjs/common";

import {
  GetHelloUseCase,
  type HelloResponse,
} from "../../application/get-hello.use-case";

@Controller("hello")
export class GetHelloRequestHandler {
  constructor(
    @Inject(GetHelloUseCase)
    private readonly getHello: GetHelloUseCase,
  ) {}

  @Get()
  handle(): HelloResponse {
    return this.getHello.execute();
  }
}
