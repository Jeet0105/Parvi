const { prisma } = require('../config/database');
const familyService = require('./family.service');

/**
 * Relationship types that place the `from` member one generation above `to`.
 * A relationship reads "from is the <type> of to".
 */
const PARENT_OF = ['FATHER', 'MOTHER'];
/** Types placing `from` one generation below `to`. */
const CHILD_OF = ['SON', 'DAUGHTER'];
/** Two generations above / below. */
const GRANDPARENT_OF = ['GRANDFATHER', 'GRANDMOTHER'];
const GRANDCHILD_OF = ['GRANDSON', 'GRANDDAUGHTER'];

const SPOUSE = ['SPOUSE'];
const SIBLING = ['BROTHER', 'SISTER'];

/** Rejected claims are not part of the family picture. */
const VISIBLE_STATUSES = ['PENDING', 'UNDER_REVIEW', 'VERIFIED'];

/**
 * Normalises a relationship into "A is N generations above B".
 * Returns null for relationships that carry no generational meaning.
 */
function generationDelta(type) {
  if (PARENT_OF.includes(type)) return 1;
  if (CHILD_OF.includes(type)) return -1;
  if (GRANDPARENT_OF.includes(type)) return 2;
  if (GRANDCHILD_OF.includes(type)) return -2;
  return null; // spouse and sibling are same-generation
}

function ageFrom(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = today.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())) {
    age -= 1;
  }
  return age;
}

/**
 * Assigns each member a generation number, where 0 is the oldest generation
 * present and larger numbers are descendants.
 *
 * Constraints are relaxed iteratively rather than solved exactly: family data
 * is citizen-entered and can be contradictory, so the pass is capped and
 * always terminates with a usable layout instead of failing.
 */
function assignGenerations(memberIds, relationships) {
  const generation = new Map(memberIds.map((id) => [id, 0]));

  // Normalise every generational link to "above is `gap` levels over below",
  // so a child-to-parent type such as SON pushes the child down rather than
  // trying to pull the parent up.
  const constraints = [];
  for (const rel of relationships) {
    const delta = generationDelta(rel.relationshipType);
    if (delta === null) continue;

    constraints.push(
      delta > 0
        ? { above: rel.fromMemberId, below: rel.toMemberId, gap: delta }
        : { above: rel.toMemberId, below: rel.fromMemberId, gap: -delta }
    );
  }

  const sameLevel = relationships
    .filter((r) => SPOUSE.includes(r.relationshipType) || SIBLING.includes(r.relationshipType))
    .map((r) => [r.fromMemberId, r.toMemberId]);

  const maxPasses = memberIds.length + 2;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;

    for (const { above, below, gap } of constraints) {
      const target = generation.get(above) + gap;
      if (generation.get(below) < target) {
        generation.set(below, target);
        changed = true;
      }
    }

    // Spouses and siblings share a row; lift the lower one to match.
    for (const [a, b] of sameLevel) {
      const highest = Math.max(generation.get(a), generation.get(b));
      if (generation.get(a) !== highest) {
        generation.set(a, highest);
        changed = true;
      }
      if (generation.get(b) !== highest) {
        generation.set(b, highest);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return generation;
}

/**
 * Builds the graph the family tree is drawn from.
 *
 * Returns structure, not pixels: the client owns layout. Generations are
 * computed here because they follow from the relationship semantics, which
 * belong to the domain rather than the view.
 */
async function getFamilyTree({ user, familyId, verificationStatus }) {
  const family = await familyService.getFamily({ user, id: familyId });

  const [members, relationships] = await Promise.all([
    prisma.familyMember.findMany({
      where: { familyId: family.id },
      orderBy: { dateOfBirth: 'asc' },
    }),
    prisma.relationship.findMany({
      where: {
        familyId: family.id,
        verificationStatus: verificationStatus
          ? verificationStatus
          : { in: VISIBLE_STATUSES },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const memberIds = members.map((m) => m.id);
  const generation = assignGenerations(memberIds, relationships);

  const nodes = members.map((member) => ({
    id: member.id,
    name: member.name,
    gender: member.gender,
    dateOfBirth: member.dateOfBirth,
    age: ageFrom(member.dateOfBirth),
    status: member.status,
    verificationStatus: member.verificationStatus,
    isHead: member.id === family.familyHeadId,
    generation: generation.get(member.id) ?? 0,
  }));

  const edges = relationships.map((rel) => ({
    id: rel.id,
    source: rel.fromMemberId,
    target: rel.toMemberId,
    type: rel.relationshipType,
    verificationStatus: rel.verificationStatus,
    // Spouse and sibling links are drawn horizontally rather than as descent.
    isHorizontal:
      SPOUSE.includes(rel.relationshipType) || SIBLING.includes(rel.relationshipType),
  }));

  return {
    familyId: family.familyId,
    familyHeadId: family.familyHeadId,
    status: family.status,
    generations: Math.max(0, ...nodes.map((n) => n.generation)) + 1,
    nodes,
    relationships: edges,
  };
}

module.exports = {
  getFamilyTree,
  assignGenerations,
  generationDelta,
  ageFrom,
};
