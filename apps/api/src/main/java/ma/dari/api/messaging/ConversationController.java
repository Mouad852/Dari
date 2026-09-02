package ma.dari.api.messaging;

import jakarta.validation.Valid;
import ma.dari.api.common.auth.CurrentUser;
import ma.dari.api.common.pagination.CursorPage;
import ma.dari.api.messaging.dto.ConversationResponse;
import ma.dari.api.messaging.dto.CreateConversationRequest;
import ma.dari.api.messaging.dto.CreateMessageRequest;
import ma.dari.api.messaging.dto.MessageResponse;
import ma.dari.api.user.User;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Messaging (phase 04). Postgres is authoritative whether or not a Firestore
 * projection is ever added.
 *
 * <p>Every method here verifies participation before reading anything. A
 * conversation id is a UUID, but guessing is not the threat — a stale or shared
 * link is, and "the id is unguessable" is not an authorization model.
 */
@RestController
@RequestMapping("/api/v1/conversations")
public class ConversationController {

    private final ConversationService conversationService;

    public ConversationController(ConversationService conversationService) {
        this.conversationService = conversationService;
    }

    /** Inbox. Carries listing context, which reads the listings table directly. */
    @GetMapping
    public CursorPage<ConversationResponse> list(@CurrentUser User user,
                                              @RequestParam(required = false) String cursor) {
        return conversationService.list(user, cursor);
    }

    /** Thread header: participant and listing context, not the messages themselves. */
    @GetMapping("/{id}")
    public ConversationResponse get(@CurrentUser User user, @PathVariable UUID id) {
        return conversationService.get(user, id);
    }

    /**
     * Starts a conversation about a listing, or returns the existing one.
     *
     * <p>Idempotent by a unique index on (listing, seeker): a second tap on
     * "Contacter" must not create a duplicate thread. An owner cannot start a
     * conversation with themselves.
     */
    @PostMapping
    public ResponseEntity<ConversationResponse> create(@CurrentUser User user,
                                                    @Valid @RequestBody CreateConversationRequest request) {
        var created = conversationService.create(user, request);
        return ResponseEntity.status(created.created() ? HttpStatus.CREATED : HttpStatus.OK)
                .body(created.response());
    }

    /** Oldest-first within a page, paged backwards from the newest. */
    @GetMapping("/{id}/messages")
    public CursorPage<MessageResponse> messages(@CurrentUser User user,
                                             @PathVariable UUID id,
                                             @RequestParam(required = false) String cursor) {
        return conversationService.listMessages(user, id, cursor);
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<MessageResponse> send(@CurrentUser User user,
                                             @PathVariable UUID id,
                                             @Valid @RequestBody CreateMessageRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(conversationService.sendMessage(user, id, request));
    }

    /** Marks read up to a point. Per-participant, never a shared flag. */
    @PatchMapping("/{id}/read")
    public void markRead(@CurrentUser User user, @PathVariable UUID id) {
        conversationService.markRead(user, id);
    }
}
