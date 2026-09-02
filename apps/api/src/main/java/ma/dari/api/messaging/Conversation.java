package ma.dari.api.messaging;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import ma.dari.api.common.jpa.Ids;
import ma.dari.api.listing.Listing;
import ma.dari.api.user.User;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversations")
public class Conversation {

    @Id
    private UUID id = Ids.newId();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "listing_id")
    private Listing listing;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_a_id", nullable = false)
    private User participantA;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "participant_b_id", nullable = false)
    private User participantB;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    protected Conversation() {
        // JPA
    }

    public Conversation(Listing listing, User participantA, User participantB) {
        this.listing = listing;
        this.participantA = normalizeFirst(participantA, participantB);
        this.participantB = normalizeSecond(participantA, participantB);
    }

    public Conversation(User participantA, User participantB) {
        this(null, participantA, participantB);
    }

    public UUID getId() {
        return id;
    }

    public Listing getListing() {
        return listing;
    }

    public User getParticipantA() {
        return participantA;
    }

    public User getParticipantB() {
        return participantB;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getDeletedAt() {
        return deletedAt;
    }

    public void setDeletedAt(Instant deletedAt) {
        this.deletedAt = deletedAt;
    }

    public boolean isParticipant(User user) {
        return user != null && (participantA.getId().equals(user.getId()) || participantB.getId().equals(user.getId()));
    }

    public User otherParticipant(User user) {
        if (participantA.getId().equals(user.getId())) {
            return participantB;
        }
        if (participantB.getId().equals(user.getId())) {
            return participantA;
        }
        throw new IllegalArgumentException("User is not in this conversation");
    }

    private User normalizeFirst(User participantA, User participantB) {
        return participantA.getId().compareTo(participantB.getId()) <= 0 ? participantA : participantB;
    }

    private User normalizeSecond(User participantA, User participantB) {
        return participantA.getId().compareTo(participantB.getId()) <= 0 ? participantB : participantA;
    }
}
