import { Injectable } from "@nestjs/common";

import { HELLO_MESSAGE } from "../domain/hello-message";

export type HelloResponse = {
  message: string;
};

@Injectable()
export class GetHelloUseCase {
  execute(): HelloResponse {
    return { message: HELLO_MESSAGE };
  }
}
