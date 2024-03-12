import app from "./app";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
prisma
  .$connect()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(
        `DB Connected !!|| Server listening on port:${process.env.PORT}`
      );
    });
  })
  .catch((error) => {
    console.log("Error connecting to DB: ", error);
  });
