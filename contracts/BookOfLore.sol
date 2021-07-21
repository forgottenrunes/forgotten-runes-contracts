// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

/**
 * @title The Book of Lore
 */
contract BookOfLore is Ownable {
    address public wizardsContractAddress;

    struct Lore {
        address creator;
        address assetAddress;
        uint256 tokenId;
        uint256 parentLoreId;
        bool nsfw;
        bool struck;
        string loreMetadataURI;
    }

    mapping(uint256 => Lore[]) public wizardLore;
    Lore[] public narrative;

    event LoreAdded(uint256 wizardId, uint256 loreIdx);
    event LoreUpdated(uint256 wizardId, uint256 loreIdx);
    event LoreStruck(uint256 wizardId, uint256 loreIdx);
    event NarrativeAdded(uint256 loreIdx);
    event NarrativeUpdated(uint256 loreIdx);

    constructor(address _wizardsContractAddress) {
        wizardsContractAddress = _wizardsContractAddress;
    }

    function numLore(uint256 wizardId) public view returns (uint256) {
        return wizardLore[wizardId].length;
    }

    function numNarrative() public view returns (uint256) {
        return narrative.length;
    }

    function loreFor(uint256 wizardId) public view returns (Lore[] memory) {
        return wizardLore[wizardId];
    }

    function loreAt(
        uint256 wizardId,
        uint256 startIdx,
        uint256 endIdx
    ) public view returns (Lore[] memory) {
        Lore[] memory l = new Lore[](endIdx - startIdx + 1);
        uint256 length = endIdx - startIdx + 1;

        for (uint256 i = 0; i < length; i++) {
            l[i] = wizardLore[wizardId][startIdx + i];
        }
        return l;
    }

    function narrativeAt(uint256 startIdx, uint256 endIdx)
        public
        view
        returns (Lore[] memory)
    {
        Lore[] memory l = new Lore[](endIdx - startIdx + 1);
        uint256 length = endIdx - startIdx + 1;

        for (uint256 i = 0; i < length; i++) {
            l[i] = narrative[startIdx + i];
        }
        return l;
    }

    function addNarrative(
        address assetAddress,
        uint256 tokenId,
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) public {
        require(
            owner() == _msgSender(),
            'Ownable: caller is not the Lore Master'
        );
        narrative.push(
            Lore(
                _msgSender(),
                assetAddress,
                tokenId,
                parentLoreId,
                nsfw,
                false,
                loreMetadataURI
            )
        );
        emit NarrativeAdded(narrative.length - 1);
    }

    function updateNarrativeMetadataURI(
        uint256 loreIdx,
        string memory newLoreMetadataURI
    ) public {
        require(
            owner() == _msgSender(),
            'Ownable: caller is not the Lore Master'
        );
        narrative[loreIdx].loreMetadataURI = newLoreMetadataURI;
        emit NarrativeUpdated(loreIdx);
    }

    function addLore(
        uint256 wizardId,
        address assetAddress,
        uint256 tokenId,
        uint256 parentLoreId,
        bool nsfw,
        string memory loreMetadataURI
    ) public {
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);
        require(
            wizardOwner == _msgSender(),
            'Owner: caller is not the Wizard owner'
        );
        wizardLore[wizardId].push(
            Lore(
                _msgSender(),
                assetAddress,
                tokenId,
                parentLoreId,
                nsfw,
                false,
                loreMetadataURI
            )
        );
        emit LoreAdded(wizardId, wizardLore[wizardId].length - 1);
    }

    function updateLoreMetadataURI(
        uint256 wizardId,
        uint256 loreIdx,
        string memory newLoreMetadataURI
    ) public {
        // is lore creator
        require(
            wizardLore[wizardId][loreIdx].creator == _msgSender(),
            'Owner: caller is not the Lore creator'
        );

        // holds wizard currently
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);
        require(
            wizardOwner == _msgSender(),
            'Owner: caller is not the Wizard owner'
        );

        wizardLore[wizardId][loreIdx].loreMetadataURI = newLoreMetadataURI;

        emit LoreUpdated(wizardId, loreIdx);
    }

    function updateLoreNSFW(
        uint256 wizardId,
        uint256 loreIdx,
        bool newNSFW
    ) public {
        address wizardOwner = IERC721(wizardsContractAddress).ownerOf(wizardId);

        require(
            (wizardLore[wizardId][loreIdx].creator == _msgSender() &&
                wizardOwner == _msgSender()) || (owner() == _msgSender()),
            'Owner: caller neither the Lore creator nor the Lore Master'
        );

        wizardLore[wizardId][loreIdx].nsfw = newNSFW;

        emit LoreUpdated(wizardId, loreIdx);
    }

    function strikeLore(
        uint256 wizardId,
        uint256 loreIdx,
        bool newStruck
    ) public {
        require(
            owner() == _msgSender(),
            'Ownable: caller is not the Lore Master'
        );

        wizardLore[wizardId][loreIdx].struck = newStruck;

        emit LoreStruck(wizardId, loreIdx);
    }
}
