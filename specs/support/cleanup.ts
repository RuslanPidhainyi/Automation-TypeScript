import { expect } from '@playwright/test';
import type { TravelApi } from '../../src/api/TravelApi';
import type { MemberUpdateDto } from '../../src/models';
import { PERSONAS, type PersonaName } from './personas';

type ApiAs = (persona: PersonaName) => Promise<TravelApi>;

interface CleanupTask {
  label: string;
  run: () => Promise<void>;
}

/**
 * Everything a test changed, and how to undo it - the `cleanup` fixture
 * (`fixtures.ts`).
 *
 * A test registers each change *before* making it. After the test, passed or
 * failed, the fixture runs every registered task in reverse order and reports
 * all failing tasks together. Every task tolerates finding nothing to undo, so
 * registering early is always safe - it is what keeps a failure halfway through
 * a test from leaving data behind.
 */
export class Cleanup {
  private readonly tasks: CleanupTask[] = [];

  constructor(private readonly apiAs: ApiAs) {}

  /** Deletes every post `owner` published under `title`. */
  post(owner: PersonaName, title: string): void {
    this.add(`post "${title}" of ${owner}`, async () => {
      const api = await this.apiAs(owner);
      await api.posts.deleteByTitle(PERSONAS[owner].credentials.username, title);
    });
  }

  /** Takes back `liker`'s like on `postId`, when there is one. */
  like(liker: PersonaName, postId: number): void {
    this.add(`like of ${liker} on post ${postId}`, async () => {
      const api = await this.apiAs(liker);
      if ((await api.likes.ids()).includes(postId)) {
        await api.likes.toggle(postId);
      }
    });
  }

  /**
   * Deletes for good the messages between `first` and `second` whose content is
   * one of `contents`.
   *
   * Two API rules make a one-sided cleanup leak rows (`TestCoveragePlan.md`,
   * *Failed attempts* #23 and #24): `DELETE messages/{id}` only flags the
   * caller's own side - the row goes once both sides have deleted it - and a
   * thread stops returning a message its caller has already deleted. So the
   * lookup runs from both sides, and both sides delete.
   */
  messages(first: PersonaName, second: PersonaName, contents: readonly string[]): void {
    this.add(`messages between ${first} and ${second}`, async () => {
      const firstApi = await this.apiAs(first);
      const secondApi = await this.apiAs(second);

      const threads = await Promise.all([
        firstApi.messages.thread(PERSONAS[second].credentials.username),
        secondApi.messages.thread(PERSONAS[first].credentials.username),
      ]);
      const ids = new Set(
        threads
          .flat()
          .filter((message) => contents.includes(message.content))
          .map((message) => message.id),
      );

      for (const id of ids) {
        // Either call may answer 400 - its side already flagged, or the row already
        // removed by the other call - which is expected and deliberately not checked.
        await firstApi.messages.removeRaw(id);
        await secondApi.messages.removeRaw(id);
      }
    });
  }

  /**
   * Snapshots `owner`'s profile right away. Afterwards it puts the four text
   * fields back exactly - `null` included - deletes every photo added since, and
   * verifies the text fields really are restored: a silent failure here would
   * corrupt the account for every later test, and the next snapshot would then
   * take the corruption for the original.
   */
  async profile(owner: PersonaName): Promise<void> {
    const api = await this.apiAs(owner);
    const username = PERSONAS[owner].credentials.username;
    const before = await api.users.get(username);
    const fields: MemberUpdateDto = {
      description: before.description,
      interests: before.interests,
      city: before.city,
      country: before.country,
    };
    const photoIds = new Set((before.generalPhotos ?? []).map((photo) => photo.id));

    this.add(`profile of ${owner}`, async () => {
      // `UpdateUser` answers 400 when nothing changed, so the result is verified, not the status.
      await api.users.updateRaw(fields);

      const after = await api.users.get(username);
      for (const photo of after.generalPhotos ?? []) {
        if (!photo.isMain && !photoIds.has(photo.id)) {
          await api.users.deletePhoto(photo.id);
        }
      }

      expect(
        {
          description: after.description,
          interests: after.interests,
          city: after.city,
          country: after.country,
        },
        `the profile of ${username} is restored`,
      ).toEqual(fields);
    });
  }

  /**
   * Snapshots `target`'s roles right away (through the `adminModerator` account)
   * and puts exactly those back afterwards. The target must hold at least one
   * role - `admin/edit-roles` refuses an empty list.
   */
  async roles(target: PersonaName): Promise<void> {
    const adminApi = await this.apiAs('adminModerator');
    const username = PERSONAS[target].credentials.username;
    const user = (await adminApi.admin.usersWithRoles()).find(
      (candidate) => candidate.username.toLowerCase() === username.toLowerCase(),
    );
    if (!user) {
      throw new Error(`${username} is missing from admin/users-with-roles`);
    }
    const roles = [...user.roles].sort();

    this.add(`roles of ${target}`, async () => {
      const restored = await adminApi.admin.editRoles(username, roles);
      expect([...restored].sort(), `the roles of ${username} are restored`).toEqual(roles);
    });
  }

  /** Runs every registered task, last registered first, and fails once with every task that failed. */
  async run(): Promise<void> {
    const failures: string[] = [];
    for (const task of [...this.tasks].reverse()) {
      try {
        await task.run();
      } catch (error) {
        failures.push(`${task.label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`Cleanup failed:\n${failures.join('\n')}`);
    }
  }

  private add(label: string, run: () => Promise<void>): void {
    this.tasks.push({ label, run });
  }
}
