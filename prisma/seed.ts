import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const venue = await prisma.venue.upsert({
    where: { id: "seed-beach-club" },
    update: {},
    create: {
      id: "seed-beach-club",
      name: "Casa Azul Beach Club",
      type: "beach_club",
      country: "ES",
      currency: "eur",
      platformFeeBps: 250,
      posSource: "internal",
    },
  });

  const spotLabels = ["Lounger 1", "Lounger 2", "Cabana A", "Table 5"];
  for (const label of spotLabels) {
    await prisma.spot.upsert({
      where: { venueId_label: { venueId: venue.id, label } },
      update: {},
      create: { venueId: venue.id, label },
    });
  }

  console.log(`Seeded venue "${venue.name}" (${venue.id}) with ${spotLabels.length} spots.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
